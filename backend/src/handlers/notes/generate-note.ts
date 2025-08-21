import { EventBridgeEvent, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';
import { publishNoteGenerationCompletedEvent } from '../../services/event.service';
import { lookupMedicalCodes } from '../../services/medical-codes.service';
import { 
  NoteStatus, 
  SOAPSections, 
  FallbackNoteTemplate,
  ClinicalNoteEntity 
} from '../../types/notes';

// Initialize AWS clients
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});
const secretsClient = new SecretsManagerClient({});

// OpenAI client cache
let openaiClient: OpenAI | null = null;
let openaiApiKey: string = '';

// Configuration from PRP
const OPENAI_SECRET_NAME = process.env.OPENAI_SECRET_NAME || '';
const GPT_CONFIG = {
  model: 'gpt-4-turbo',
  temperature: 0.3,
  max_tokens: 2000,
  timeout: 8000, // 8 seconds, leaving 2s buffer for 10s requirement
};

/**
 * Get OpenAI client with cached API key
 * Following exact pattern from transcription service
 */
async function getOpenAIClient(): Promise<OpenAI> {
  if (!openaiClient && OPENAI_SECRET_NAME) {
    try {
      logger.info('[OpenAI] Loading API key from secret', { secretName: OPENAI_SECRET_NAME });
      
      const secretResponse = await secretsClient.send(
        new GetSecretValueCommand({
          SecretId: OPENAI_SECRET_NAME,
        })
      );

      if (secretResponse.SecretString) {
        openaiApiKey = secretResponse.SecretString;
        logger.info('[OpenAI] API key loaded successfully');
        openaiClient = new OpenAI({ 
          apiKey: openaiApiKey,
          timeout: GPT_CONFIG.timeout,
        });
      } else {
        throw new Error(`Secret ${OPENAI_SECRET_NAME} has no value`);
      }
    } catch (error) {
      logger.error('[OpenAI] Failed to load API key from secret', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        secretName: OPENAI_SECRET_NAME,
      });
      throw new Error('Failed to initialize OpenAI client');
    }
  }

  if (!openaiClient) {
    throw new Error('OpenAI client not available');
  }

  return openaiClient;
}

/**
 * Generate SOAP note using GPT-4 with exact prompt from PRP
 */
async function generateSOAPNote(transcript: string): Promise<SOAPSections> {
  const client = await getOpenAIClient();
  
  // Exact GPT-4 configuration from PRP
  const messages = [
    {
      role: 'system' as const,
      content: `You are a medical scribe for primary care.
      CRITICAL RULES:
      - Extract ONLY information explicitly stated
      - NEVER invent medical information
      - If unsure, mark with [?]
      - Vitals ALWAYS: "[See EHR flowsheet]"
      - Physical exam: ONLY what doctor verbalizes
      - Return valid JSON only`
    },
    {
      role: 'user' as const,
      content: `Convert to SOAP note JSON:
      Chief Complaint: First patient concern (first 30 seconds)
      HPI: Use OPQRST format if applicable
      ROS: Systems mentioned
      Medications: Include dosages
      Assessment: Concise diagnoses
      Plan: Numbered action items
      
      Return JSON in this exact format:
      {
        "chiefComplaint": "string",
        "subjective": {
          "hpi": "string",
          "ros": "string",
          "medications": ["med + dosage"],
          "allergies": ["allergy + reaction"]
        },
        "objective": {
          "vitals": "[See EHR flowsheet]",
          "physicalExam": "string"
        },
        "assessment": "string",
        "plan": ["1. action", "2. action"]
      }
      
      TRANSCRIPT: ${transcript}`
    }
  ];

  try {
    logger.info('[GPT-4] Generating SOAP note', { 
      transcriptLength: transcript.length,
      model: GPT_CONFIG.model,
    });

    const startTime = Date.now();
    
    const response = await client.chat.completions.create({
      model: GPT_CONFIG.model,
      messages,
      temperature: GPT_CONFIG.temperature,
      max_tokens: GPT_CONFIG.max_tokens,
    });

    const processingTime = Date.now() - startTime;
    logger.info('[GPT-4] Note generation completed', { 
      processingTimeMs: processingTime,
      usage: response.usage,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content returned from GPT-4');
    }

    // Parse and validate JSON response
    let soapNote: SOAPSections;
    try {
      soapNote = JSON.parse(content);
    } catch (parseError) {
      logger.error('[GPT-4] Failed to parse JSON response', { 
        content: content.substring(0, 500),
        error: parseError instanceof Error ? parseError.message : 'Parse error',
      });
      throw new Error('Invalid JSON response from GPT-4');
    }

    // Validate required fields
    if (!soapNote.chiefComplaint || !soapNote.assessment) {
      throw new Error('Missing required SOAP note sections');
    }

    // Ensure vitals is always "[See EHR flowsheet]" as per PRP
    soapNote.objective.vitals = '[See EHR flowsheet]';

    return soapNote;

  } catch (error) {
    logger.error('[GPT-4] Note generation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      transcriptLength: transcript.length,
    });
    throw error;
  }
}

/**
 * Retry logic with exponential backoff as specified in PRP
 */
async function withRetry<T>(
  fn: () => Promise<T>, 
  maxAttempts: number = 2
): Promise<T> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = i === maxAttempts - 1;
      
      if (isLastAttempt) {
        throw error;
      }

      const delay = 1000 * Math.pow(2, i); // 1s, 2s
      logger.warn(`[Retry] Attempt ${i + 1} failed, retrying in ${delay}ms`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Max retry attempts reached');
}

/**
 * Fetch all transcripts for an encounter
 */
async function getEncounterTranscripts(encounterId: string): Promise<string> {
  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: process.env.TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
        ExpressionAttributeValues: {
          ':pk': `ENCOUNTER#${encounterId}`,
          ':sk': 'TRANSCRIPT#',
        },
        ScanIndexForward: true, // Order by timestamp
      })
    );

    if (!result.Items || result.Items.length === 0) {
      throw new Error(`No transcripts found for encounter ${encounterId}`);
    }

    // Combine all transcript segments into full conversation
    const fullTranscript = result.Items
      .map(item => item.text || '')
      .join(' ')
      .trim();

    if (!fullTranscript) {
      throw new Error('Empty transcript content');
    }

    logger.info('[Transcripts] Retrieved encounter transcripts', {
      encounterId,
      segmentCount: result.Items.length,
      totalLength: fullTranscript.length,
    });

    return fullTranscript;

  } catch (error) {
    logger.error('[Transcripts] Failed to retrieve encounter transcripts', {
      encounterId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Store transcript in S3 with encryption (from PRP)
 */
async function storeTranscriptInS3(
  encounterId: string, 
  transcript: string
): Promise<string> {
  const s3Key = `transcripts/${encounterId}/${Date.now()}-transcript.txt`;
  
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.AUDIO_BUCKET_NAME,
        Key: s3Key,
        Body: transcript,
        ServerSideEncryption: 'AES256',
        ContentType: 'text/plain',
      })
    );

    logger.info('[S3] Transcript stored successfully', {
      encounterId,
      s3Key,
      size: transcript.length,
    });

    return s3Key;
  } catch (error) {
    logger.error('[S3] Failed to store transcript', {
      encounterId,
      s3Key,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Save clinical note to DynamoDB with versioning
 */
async function saveClinicalNote(
  encounterId: string,
  providerId: string,
  sections: SOAPSections,
  codes: any,
  transcriptS3Key: string,
  processingTimeMs: number
): Promise<string> {
  const noteId = uuidv4();
  const now = new Date().toISOString();
  const version = 1;

  const noteEntity: ClinicalNoteEntity = {
    pk: `ENCOUNTER#${encounterId}`,
    sk: `NOTE#${noteId}#VERSION#${version.toString().padStart(3, '0')}`,
    gsi1pk: `NOTE#${noteId}`,
    gsi1sk: `ENCOUNTER#${encounterId}`,
    gsi2pk: `PROVIDER#${providerId}#DATE#${now.split('T')[0]}`,
    gsi2sk: `NOTE#${now}#${noteId}`,
    entityType: 'CLINICAL_NOTE',
    ttl: Math.floor(Date.now() / 1000) + (7 * 365 * 24 * 60 * 60), // 7 years

    // Note content from PRP schema
    noteId,
    encounterId,
    status: NoteStatus.DRAFT,
    sections,
    codes,
    metadata: {
      generatedAt: now,
      lastModified: now,
      modifiedBy: providerId,
      version,
      processingTimeMs,
    },
    audit: {
      created: {
        userId: providerId,
        timestamp: now,
      },
      edits: [],
    },
    transcriptS3Key,
  };

  try {
    await docClient.send(
      new PutCommand({
        TableName: process.env.TABLE_NAME,
        Item: noteEntity,
        ConditionExpression: 'attribute_not_exists(pk)',
      })
    );

    logger.info('[DynamoDB] Clinical note saved successfully', {
      noteId,
      encounterId,
      providerId,
      version,
    });

    return noteId;
  } catch (error) {
    logger.error('[DynamoDB] Failed to save clinical note', {
      noteId,
      encounterId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Main note generation handler
 * Triggered by EventBridge when transcription completes
 */
export const handler = async (
  event: EventBridgeEvent<'Transcription Completed', any>,
  context: Context
): Promise<void> => {
  const startTime = Date.now();
  const requestId = context.awsRequestId;

  logger.info('[Generate Note] Handler started', {
    requestId,
    event: event.detail,
  });

  try {
    // Extract event data
    const { encounterId, recordingId, transcriptCount, providerId } = event.detail;

    if (!encounterId || !providerId) {
      throw new Error('Missing required fields: encounterId or providerId');
    }

    // Step 1: Fetch all transcripts for the encounter
    logger.info('[Generate Note] Fetching transcripts', { encounterId, requestId });
    const fullTranscript = await getEncounterTranscripts(encounterId);

    // Step 2: Store transcript in S3 (encrypted)
    logger.info('[Generate Note] Storing transcript in S3', { encounterId, requestId });
    const transcriptS3Key = await storeTranscriptInS3(encounterId, fullTranscript);

    // Step 3: Generate SOAP note with GPT-4 and retry logic
    logger.info('[Generate Note] Generating SOAP note', { encounterId, requestId });
    let soapSections: SOAPSections;
    
    try {
      soapSections = await withRetry(() => generateSOAPNote(fullTranscript));
    } catch (error) {
      logger.warn('[Generate Note] GPT-4 failed, using fallback template', {
        encounterId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId,
      });
      
      // Use fallback template as specified in PRP
      soapSections = { ...FallbackNoteTemplate };
      metrics.count('NoteGenerationFallback', 1);
    }

    // Step 4: Lookup ICD-10/CPT codes
    logger.info('[Generate Note] Looking up medical codes', { encounterId, requestId });
    const medicalCodes = lookupMedicalCodes(
      soapSections.assessment,
      'followup', // Default visit type, should come from encounter data
      Math.round((fullTranscript.length / 150) * 60) // Estimate duration from transcript
    );

    // Step 5: Save note to DynamoDB with audit log
    const processingTimeMs = Date.now() - startTime;
    logger.info('[Generate Note] Saving clinical note', { encounterId, requestId });
    
    const noteId = await saveClinicalNote(
      encounterId,
      providerId,
      soapSections,
      medicalCodes,
      transcriptS3Key,
      processingTimeMs
    );

    // Step 6: Track metrics
    metrics.success('GenerateNote');
    metrics.duration('NoteGenerationTime', startTime);
    metrics.count('NotesGenerated', 1);

    // Step 7: Publish completion event (optional)
    await publishNoteGenerationCompletedEvent({
      encounterId,
      noteId,
      providerId,
      status: 'DRAFT',
      generatedAt: new Date().toISOString(),
      processingTimeMs,
      requestId,
    });

    logger.info('[Generate Note] Note generation completed successfully', {
      noteId,
      encounterId,
      processingTimeMs,
      requestId,
    });

  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    
    logger.error('[Generate Note] Note generation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      processingTimeMs,
      requestId,
      event: event.detail,
    });

    // Track failure metrics
    metrics.error('GenerateNote');
    metrics.duration('NoteGenerationTime', startTime);

    // Don't throw - we don't want to retry indefinitely
    // The error is logged and metrics are tracked
  }
};