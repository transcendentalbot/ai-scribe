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
  chunkBuffer: Buffer[];
  bufferSize: number;
}

class AudioService {
  private readonly bucketName = process.env.AUDIO_BUCKET_NAME!;
  private readonly tableName = process.env.TABLE_NAME!;
  private readonly connectionsTable = process.env.CONNECTIONS_TABLE_NAME!;
  private readonly MIN_PART_SIZE = 5 * 1024 * 1024; // 5MB minimum for S3 multipart
  private sessionBuffers: Map<string, Buffer[]> = new Map(); // In-memory buffer storage

  // Store session in DynamoDB instead of memory
  private async storeSession(session: RecordingSession) {
    // Don't store the buffer in DynamoDB, only metadata
    const { chunkBuffer, ...sessionWithoutBuffer } = session;
    await docClient.send(
      new PutCommand({
        TableName: this.connectionsTable,
        Item: {
          connectionId: `SESSION#${session.sessionId}`,
          sessionData: JSON.stringify(sessionWithoutBuffer),
          ttl: Math.floor(Date.now() / 1000) + 3600, // 1 hour TTL
          timestamp: Date.now(),
        },
      })
    );
    console.log(`[AudioService] Session ${session.sessionId} stored in DynamoDB`);
  }

  // Get session from DynamoDB
  private async getSession(sessionId: string): Promise<RecordingSession | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: this.connectionsTable,
        Key: {
          connectionId: `SESSION#${sessionId}`,
        },
      })
    );
    
    if (!result.Item || !result.Item.sessionData) {
      console.log(`[AudioService] Session not found for ${sessionId}`);
      return null;
    }
    
    // Parse the stored session data and restore buffer from memory
    const session = JSON.parse(result.Item.sessionData) as RecordingSession;
    session.chunkBuffer = this.sessionBuffers.get(sessionId) || [];
    session.bufferSize = session.bufferSize || 0;
    console.log(`[AudioService] Retrieved session ${sessionId} from DynamoDB`);
    return session;
  }

  // Update session in DynamoDB
  private async updateSession(sessionId: string, updates: Partial<RecordingSession>) {
    // Get current session
    const currentSession = await this.getSession(sessionId);
    if (!currentSession) {
      throw new Error(`Cannot update non-existent session: ${sessionId}`);
    }
    
    // Apply updates
    const updatedSession = { ...currentSession, ...updates };
    
    // Don't store the buffer in DynamoDB
    const { chunkBuffer, ...sessionWithoutBuffer } = updatedSession;
    
    // Store updated session
    await docClient.send(
      new UpdateCommand({
        TableName: this.connectionsTable,
        Key: {
          connectionId: `SESSION#${sessionId}`,
        },
        UpdateExpression: 'SET sessionData = :data',
        ExpressionAttributeValues: {
          ':data': JSON.stringify(sessionWithoutBuffer),
        },
      })
    );
    console.log(`[AudioService] Updated session ${sessionId} in DynamoDB`);
  }

  // Delete session from DynamoDB
  private async deleteSession(sessionId: string) {
    await docClient.send(
      new DeleteCommand({
        TableName: this.connectionsTable,
        Key: {
          connectionId: `SESSION#${sessionId}`,
        },
      })
    );
    // Clear in-memory buffer
    this.sessionBuffers.delete(sessionId);
    console.log(`[AudioService] Deleted session ${sessionId} from DynamoDB and cleared buffer`);
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
      chunkBuffer: [],
      bufferSize: 0,
    };

    // Initialize in-memory buffer first
    this.sessionBuffers.set(sessionId, []);
    
    // Store in DynamoDB
    await this.storeSession(session);
    console.log(`[AudioService] Session stored in DynamoDB and buffer initialized`);

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
    
    // Get session from DynamoDB with retry
    let session = await this.getSession(sessionId);
    
    // If session not found, wait a bit and retry once (in case of race condition)
    if (!session) {
      console.log(`[AudioService] Session not found on first try, waiting 500ms and retrying...`);
      await new Promise(resolve => setTimeout(resolve, 500));
      session = await this.getSession(sessionId);
    }
    
    if (!session) {
      console.error(`[AudioService] Session not found after retry: ${sessionId}`);
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
    
    // Add to in-memory buffer
    let buffers = this.sessionBuffers.get(sessionId) || [];
    buffers.push(buffer);
    this.sessionBuffers.set(sessionId, buffers);
    session.bufferSize += buffer.length;
    console.log(`[AudioService] Added chunk to buffer. Current buffer size: ${session.bufferSize} bytes`);
    
    // Check if buffer exceeds minimum part size
    if (session.bufferSize >= this.MIN_PART_SIZE) {
      // Combine all buffers
      const combinedBuffer = Buffer.concat(buffers);
      
      // Upload as a part
      const partNumber = session.parts.length + 1;
      console.log(`[AudioService] Buffer reached ${session.bufferSize} bytes, uploading as part ${partNumber}`);
      
      const uploadPartResult = await s3Client.send(
        new UploadPartCommand({
          Bucket: this.bucketName,
          Key: session.s3Key,
          UploadId: session.uploadId,
          PartNumber: partNumber,
          Body: combinedBuffer,
        })
      );
      
      console.log(`[AudioService] Part ${partNumber} uploaded successfully, ETag: ${uploadPartResult.ETag}`);
      
      // Update session with new part and clear buffer
      const updatedParts = [...session.parts, {
        ETag: uploadPartResult.ETag!,
        PartNumber: partNumber,
      }];
      
      await this.updateSession(sessionId, {
        parts: updatedParts,
        lastSequenceNumber: sequenceNumber,
        bufferSize: 0,
      });
      
      // Clear the in-memory buffer
      this.sessionBuffers.set(sessionId, []);
    } else {
      // Just update the sequence number and buffer size
      await this.updateSession(sessionId, {
        lastSequenceNumber: sequenceNumber,
        bufferSize: session.bufferSize,
      });
    }

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

    console.log(`[AudioService] Session found. Parts uploaded: ${session.parts.length}, Buffer size: ${session.bufferSize}`);

    // Upload any remaining buffered data
    if (session.bufferSize > 0) {
      const buffers = this.sessionBuffers.get(sessionId) || [];
      if (buffers.length > 0) {
        console.log(`[AudioService] Uploading remaining buffer of ${session.bufferSize} bytes as final part`);
        
        const combinedBuffer = Buffer.concat(buffers);
        const finalPartNumber = session.parts.length + 1;
        
        // Upload the final part (can be less than 5MB)
        const uploadPartResult = await s3Client.send(
          new UploadPartCommand({
            Bucket: this.bucketName,
            Key: session.s3Key,
            UploadId: session.uploadId,
            PartNumber: finalPartNumber,
            Body: combinedBuffer,
          })
        );
        
        console.log(`[AudioService] Final part ${finalPartNumber} uploaded successfully, ETag: ${uploadPartResult.ETag}`);
        
        // Add the final part to the parts list
        session.parts.push({
          ETag: uploadPartResult.ETag!,
          PartNumber: finalPartNumber,
        });
      }
    }

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

    // Clean up session from DynamoDB and in-memory buffer
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