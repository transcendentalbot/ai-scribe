import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createResponse } from '../../utils/response';

const s3Client = new S3Client({});
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const response = createResponse();

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const { recordingId } = event.pathParameters || {};
    
    if (!recordingId) {
      return response.error('Recording ID is required', 400);
    }

    console.log('[Debug Recording] Fetching recording:', recordingId);

    // Get recording metadata from DynamoDB
    const recordingResult = await docClient.send(
      new GetCommand({
        TableName: process.env.RECORDINGS_TABLE_NAME!,
        Key: { recordingId },
      })
    );

    if (!recordingResult.Item) {
      return response.error('Recording not found', 404);
    }

    const recording = recordingResult.Item;
    console.log('[Debug Recording] DynamoDB data:', recording);

    // Get S3 object metadata
    let s3Metadata;
    try {
      const headResult = await s3Client.send(
        new HeadObjectCommand({
          Bucket: process.env.AUDIO_BUCKET_NAME!,
          Key: recording.s3Key,
        })
      );
      
      s3Metadata = {
        contentType: headResult.ContentType,
        contentLength: headResult.ContentLength,
        lastModified: headResult.LastModified,
        eTag: headResult.ETag,
        metadata: headResult.Metadata,
        serverSideEncryption: headResult.ServerSideEncryption,
      };
      
      console.log('[Debug Recording] S3 metadata:', s3Metadata);
    } catch (error) {
      console.error('[Debug Recording] S3 head error:', error);
      s3Metadata = { error: error instanceof Error ? error.message : 'Unknown error' };
    }

    // Get first 1KB of file content for analysis
    let fileAnalysis;
    try {
      const getResult = await s3Client.send(
        new GetObjectCommand({
          Bucket: process.env.AUDIO_BUCKET_NAME!,
          Key: recording.s3Key,
          Range: 'bytes=0-1024',
        })
      );
      
      if (getResult.Body) {
        const chunks: Uint8Array[] = [];
        for await (const chunk of getResult.Body as any) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        const bytes = new Uint8Array(buffer);
        
        // Check file signature
        const signature = Array.from(bytes.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' ');
        const hasWebMSignature = bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
        const hasOggSignature = bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53;
        
        fileAnalysis = {
          signature,
          hasWebMSignature,
          hasOggSignature,
          first20Bytes: Array.from(bytes.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' '),
          fileType: hasWebMSignature ? 'WebM' : hasOggSignature ? 'Ogg' : 'Unknown',
        };
      }
    } catch (error) {
      console.error('[Debug Recording] File analysis error:', error);
      fileAnalysis = { error: error instanceof Error ? error.message : 'Unknown error' };
    }

    // Generate test URLs with different content types
    const testUrls: Record<string, string> = {};
    const contentTypes = [
      'audio/webm',
      'audio/webm;codecs=opus',
      'audio/ogg',
      'audio/ogg;codecs=opus',
      'application/octet-stream',
    ];
    
    for (const contentType of contentTypes) {
      try {
        const url = await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: process.env.AUDIO_BUCKET_NAME!,
            Key: recording.s3Key,
            ResponseContentType: contentType,
            ResponseContentDisposition: 'inline',
          }),
          { expiresIn: 3600 }
        );
        testUrls[contentType] = url;
      } catch (error) {
        testUrls[contentType] = 'Error generating URL';
      }
    }

    const debugInfo = {
      recordingId,
      dynamoData: {
        s3Key: recording.s3Key,
        mimeType: recording.mimeType,
        fileSize: recording.fileSize,
        duration: recording.duration,
        createdAt: recording.createdAt,
        metadata: recording.metadata,
      },
      s3Metadata,
      fileAnalysis,
      testUrls,
      recommendations: generateRecommendations(recording, s3Metadata, fileAnalysis),
    };

    return response.success(debugInfo);
  } catch (error) {
    console.error('[Debug Recording] Error:', error);
    return response.error(
      error instanceof Error ? error.message : 'Failed to debug recording',
      500
    );
  }
};

function generateRecommendations(recording: any, s3Metadata: any, fileAnalysis: any): string[] {
  const recommendations: string[] = [];
  
  if (fileAnalysis?.hasWebMSignature) {
    recommendations.push('File is a valid WebM container');
    if (!recording.mimeType?.includes('webm')) {
      recommendations.push('WARNING: File is WebM but mimeType in DB is ' + recording.mimeType);
    }
  } else if (fileAnalysis?.hasOggSignature) {
    recommendations.push('File is a valid Ogg container');
    if (!recording.mimeType?.includes('ogg')) {
      recommendations.push('WARNING: File is Ogg but mimeType in DB is ' + recording.mimeType);
    }
  } else if (fileAnalysis?.signature) {
    recommendations.push('WARNING: Unknown file format with signature: ' + fileAnalysis.signature);
  }
  
  if (s3Metadata?.contentType && s3Metadata.contentType !== recording.mimeType) {
    recommendations.push(`S3 content type (${s3Metadata.contentType}) differs from DB mimeType (${recording.mimeType})`);
  }
  
  if (!recording.duration || recording.duration === 0) {
    recommendations.push('Recording has no duration metadata - playback controls may not work properly');
  }
  
  return recommendations;
}