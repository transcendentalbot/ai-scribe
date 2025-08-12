import { S3Client, PutObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
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
  chunkBuffer: Buffer[];
  lastSequenceNumber: number;
}

// In-memory session storage (consider Redis for production)
const sessions = new Map<string, RecordingSession>();

class AudioService {
  private readonly bucketName = process.env.AUDIO_BUCKET_NAME!;
  private readonly tableName = process.env.TABLE_NAME!;

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

    // Initialize multipart upload
    const multipartUpload = await s3Client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        ContentType: 'audio/webm',
        Metadata: {
          encounterId,
          sessionId,
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
      chunkBuffer: [],
      lastSequenceNumber: -1,
    };

    sessions.set(sessionId, session);

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
    const session = sessions.get(sessionId);
    if (!session || session.connectionId !== connectionId) {
      throw new Error('Invalid session');
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

    session.lastSequenceNumber = sequenceNumber;

    // Convert base64 to buffer
    const buffer = Buffer.from(chunk, 'base64');
    session.chunkBuffer.push(buffer);

    // When buffer reaches ~1MB, upload as part (reduced from 5MB for faster uploads)
    const bufferSize = session.chunkBuffer.reduce((sum, b) => sum + b.length, 0);
    console.log(`[AudioService] Current buffer size: ${bufferSize} bytes`);
    if (bufferSize >= 1 * 1024 * 1024) {
      console.log(`[AudioService] Buffer threshold reached, uploading part`);
      await this.uploadPart(session);
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
    
    const session = sessions.get(sessionId);
    if (!session) {
      console.error(`[AudioService] Session not found: ${sessionId}`);
      console.log('[AudioService] Available sessions:', Array.from(sessions.keys()));
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    if (session.connectionId !== connectionId) {
      console.error(`[AudioService] Connection mismatch. Expected: ${session.connectionId}, Got: ${connectionId}`);
      throw new Error('Invalid session - connection mismatch');
    }

    console.log(`[AudioService] Session found. Parts uploaded: ${session.parts.length}, Buffer size: ${session.chunkBuffer.length}`);

    // Upload remaining chunks
    if (session.chunkBuffer.length > 0) {
      console.log(`[AudioService] Uploading final part with ${session.chunkBuffer.length} chunks`);
      await this.uploadPart(session);
    }

    // Only complete multipart upload if we have parts
    if (session.parts.length === 0) {
      console.warn(`[AudioService] No parts uploaded for session ${sessionId}`);
      // Clean up the multipart upload
      // For now, we'll just skip completion
      sessions.delete(sessionId);
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

    // Clean up session
    sessions.delete(sessionId);

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
    const session = sessions.get(sessionId);
    if (!session || session.connectionId !== connectionId) {
      throw new Error('Invalid session');
    }

    session.isPaused = isPaused;
    return { status: isPaused ? 'paused' : 'resumed' };
  }

  private async uploadPart(session: RecordingSession) {
    const partNumber = session.parts.length + 1;
    const data = Buffer.concat(session.chunkBuffer);
    
    console.log(`[AudioService] Uploading part ${partNumber}, size: ${data.length} bytes`);

    const uploadPartResult = await s3Client.send(
      new UploadPartCommand({
        Bucket: this.bucketName,
        Key: session.s3Key,
        UploadId: session.uploadId,
        PartNumber: partNumber,
        Body: data,
      })
    );

    console.log(`[AudioService] Part ${partNumber} uploaded successfully, ETag: ${uploadPartResult.ETag}`);

    session.parts.push({
      ETag: uploadPartResult.ETag!,
      PartNumber: partNumber,
    });

    // Clear buffer
    session.chunkBuffer = [];
  }
}

export const audioService = new AudioService();