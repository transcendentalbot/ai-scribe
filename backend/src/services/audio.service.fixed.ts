import { S3Client, PutObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({});
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface RecordingSession {
  sessionId: string;
  connectionId: string;
  encounterId: string;
  startTime: string;
  uploadId?: string;
  parts: Array<{ ETag: string; PartNumber: number }>;
  s3Key: string;
  isPaused: boolean;
  totalDuration: number;
  lastSequenceNumber: number;
  // Remove chunkBuffer - we'll upload chunks immediately
}

class AudioService {
  private readonly bucketName = process.env.AUDIO_BUCKET_NAME!;
  private readonly tableName = process.env.TABLE_NAME!;
  private readonly connectionsTable = process.env.CONNECTIONS_TABLE_NAME!;

  // Store session in DynamoDB instead of memory
  private async storeSession(session: RecordingSession) {
    await docClient.send(
      new PutCommand({
        TableName: this.connectionsTable,
        Item: {
          pk: `SESSION#${session.sessionId}`,
          sk: 'METADATA',
          ...session,
          ttl: Math.floor(Date.now() / 1000) + 3600, // 1 hour TTL
        },
      })
    );
  }

  // Get session from DynamoDB
  private async getSession(sessionId: string): Promise<RecordingSession | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: this.connectionsTable,
        Key: {
          pk: `SESSION#${sessionId}`,
          sk: 'METADATA',
        },
      })
    );
    
    if (!result.Item) return null;
    
    // Remove DynamoDB-specific fields
    const { pk, sk, ttl, ...session } = result.Item;
    return session as RecordingSession;
  }

  // Update session in DynamoDB
  private async updateSession(sessionId: string, updates: Partial<RecordingSession>) {
    const updateExpression = Object.keys(updates)
      .map((key, index) => `#field${index} = :value${index}`)
      .join(', ');
    
    const expressionAttributeNames = Object.keys(updates).reduce((acc, key, index) => ({
      ...acc,
      [`#field${index}`]: key,
    }), {});
    
    const expressionAttributeValues = Object.entries(updates).reduce((acc, [_, value], index) => ({
      ...acc,
      [`:value${index}`]: value,
    }), {});

    await docClient.send(
      new UpdateCommand({
        TableName: this.connectionsTable,
        Key: {
          pk: `SESSION#${sessionId}`,
          sk: 'METADATA',
        },
        UpdateExpression: `SET ${updateExpression}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );
  }

  // Delete session from DynamoDB
  private async deleteSession(sessionId: string) {
    await docClient.send(
      new DeleteCommand({
        TableName: this.connectionsTable,
        Key: {
          pk: `SESSION#${sessionId}`,
          sk: 'METADATA',
        },
      })
    );
  }

  async startRecording({
    connectionId,
    encounterId,
    metadata,
  }: {
    connectionId: string;
    encounterId: string;
    metadata?: any;
  }) {
    const sessionId = uuidv4();
    const timestamp = new Date().toISOString();
    const s3Key = `recordings/${encounterId}/${sessionId}/audio.webm`;

    console.log(`[AudioService] Starting recording - sessionId: ${sessionId}, connectionId: ${connectionId}`);

    // Initialize multipart upload
    const multipartUpload = await s3Client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        ContentType: 'audio/webm',
        Metadata: {
          encounterId,
          sessionId,
          connectionId,
          startTime: timestamp,
          ...(metadata ? Object.entries(metadata).reduce((acc, [key, value]) => ({
            ...acc,
            [key]: String(value)
          }), {}) : {}),
        },
        ServerSideEncryption: 'aws:kms',
      })
    );

    // Create session
    const session: RecordingSession = {
      sessionId,
      connectionId,
      encounterId,
      startTime: timestamp,
      uploadId: multipartUpload.UploadId,
      parts: [],
      s3Key,
      isPaused: false,
      totalDuration: 0,
      lastSequenceNumber: -1,
    };

    // Store in DynamoDB
    await this.storeSession(session);
    console.log(`[AudioService] Session stored in DynamoDB`);

    // Generate pre-signed URL for direct uploads (optional)
    const uploadUrl = await getSignedUrl(
      s3Client,
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: `${s3Key}.chunks/${sessionId}-chunk-`,
      }),
      { expiresIn: 3600 }
    );

    return {
      sessionId,
      uploadUrl,
      s3Key,
    };
  }

  async processAudioChunk({
    connectionId,
    sessionId,
    chunk,
    sequenceNumber,
  }: {
    connectionId: string;
    sessionId: string;
    chunk: string; // base64 encoded
    sequenceNumber: number;
  }) {
    console.log(`[AudioService] Processing chunk - sessionId: ${sessionId}, seq: ${sequenceNumber}, connectionId: ${connectionId}`);
    
    // Get session from DynamoDB
    const session = await this.getSession(sessionId);
    
    if (!session) {
      console.error(`[AudioService] Session not found: ${sessionId}`);
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    if (session.connectionId !== connectionId) {
      console.error(`[AudioService] Connection mismatch - expected: ${session.connectionId}, got: ${connectionId}`);
      throw new Error('Invalid session - connection mismatch');
    }

    if (session.isPaused) {
      return { status: 'paused' };
    }

    // Validate sequence
    if (sequenceNumber !== session.lastSequenceNumber + 1) {
      console.warn('Out of sequence chunk received', {
        expected: session.lastSequenceNumber + 1,
        received: sequenceNumber,
      });
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(chunk, 'base64');
    
    // Upload chunk immediately as a part
    const partNumber = session.parts.length + 1;
    console.log(`[AudioService] Uploading part ${partNumber}, size: ${buffer.length} bytes`);

    const uploadPartResult = await s3Client.send(
      new UploadPartCommand({
        Bucket: this.bucketName,
        Key: session.s3Key,
        UploadId: session.uploadId,
        PartNumber: partNumber,
        Body: buffer,
      })
    );

    console.log(`[AudioService] Part ${partNumber} uploaded successfully, ETag: ${uploadPartResult.ETag}`);

    // Update session with new part and sequence number
    const updatedParts = [...session.parts, {
      ETag: uploadPartResult.ETag!,
      PartNumber: partNumber,
    }];
    
    await this.updateSession(sessionId, {
      parts: updatedParts,
      lastSequenceNumber: sequenceNumber,
    });

    return { status: 'processed', sequenceNumber };
  }

  async stopRecording({
    connectionId,
    sessionId,
  }: {
    connectionId: string;
    sessionId: string;
  }) {
    console.log(`[AudioService] Stopping recording for session: ${sessionId}`);
    
    // Get session from DynamoDB
    const session = await this.getSession(sessionId);
    
    if (!session) {
      console.error(`[AudioService] Session not found: ${sessionId}`);
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    if (session.connectionId !== connectionId) {
      console.error(`[AudioService] Connection mismatch. Expected: ${session.connectionId}, Got: ${connectionId}`);
      throw new Error('Invalid session - connection mismatch');
    }

    console.log(`[AudioService] Session found. Parts uploaded: ${session.parts.length}`);

    // Only complete multipart upload if we have parts
    if (session.parts.length === 0) {
      console.warn(`[AudioService] No parts uploaded for session ${sessionId}`);
      // Clean up the multipart upload
      await this.deleteSession(sessionId);
      throw new Error('No audio data was recorded');
    }

    console.log(`[AudioService] Completing multipart upload with ${session.parts.length} parts`);
    // Complete multipart upload
    await s3Client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: session.s3Key,
        UploadId: session.uploadId,
        MultipartUpload: {
          Parts: session.parts,
        },
      })
    );

    // Calculate duration
    const endTime = new Date();
    const startTime = new Date(session.startTime);
    const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

    // Create recording record
    const recordingId = uuidv4();
    await docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          pk: `ENCOUNTER#${session.encounterId}`,
          sk: 'METADATA',
        },
        UpdateExpression: 'SET recordings = list_append(if_not_exists(recordings, :empty), :recording)',
        ExpressionAttributeValues: {
          ':empty': [],
          ':recording': [{
            id: recordingId,
            startTime: session.startTime,
            endTime: endTime.toISOString(),
            duration,
            s3Key: session.s3Key,
            transcriptionId: null,
          }],
        },
      })
    );

    // Clean up session from DynamoDB
    await this.deleteSession(sessionId);

    return {
      recordingId,
      duration,
      s3Key: session.s3Key,
    };
  }

  async updateRecordingStatus({
    connectionId,
    sessionId,
    isPaused,
  }: {
    connectionId: string;
    sessionId: string;
    isPaused: boolean;
  }) {
    const session = await this.getSession(sessionId);
    
    if (!session || session.connectionId !== connectionId) {
      throw new Error('Invalid session');
    }

    await this.updateSession(sessionId, { isPaused });
    return { status: isPaused ? 'paused' : 'resumed' };
  }
}

export const audioService = new AudioService();