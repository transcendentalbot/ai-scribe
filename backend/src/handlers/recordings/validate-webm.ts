import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Buffer } from 'buffer';

const s3Client = new S3Client({});
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface WebMValidation {
  isValid: boolean;
  hasWebMSignature: boolean;
  signature: string;
  codecInfo: string;
  docType: string;
  fileSize: number;
  contentType: string;
  issues: string[];
}

async function validateWebMBuffer(buffer: Buffer): Promise<WebMValidation> {
  const bytes = new Uint8Array(buffer);
  const issues: string[] = [];
  
  // Check WebM signature
  const signature = Array.from(bytes.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' ');
  const hasWebMSignature = bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  
  if (!hasWebMSignature) {
    issues.push('Invalid WebM signature - file may be corrupted');
  }
  
  // Look for DocType (WebM identifier)
  const decoder = new TextDecoder();
  let docType = 'Unknown';
  let codecInfo = 'Unknown';
  
  // Search for DocType (0x4282)
  for (let i = 0; i < Math.min(bytes.length - 10, 1000); i++) {
    if (bytes[i] === 0x42 && bytes[i + 1] === 0x82) {
      const length = bytes[i + 2];
      if (length > 0 && length < 20) {
        docType = decoder.decode(bytes.slice(i + 3, i + 3 + length));
        break;
      }
    }
  }
  
  if (docType !== 'webm' && docType !== 'Unknown') {
    issues.push(`Unexpected DocType: ${docType} (expected 'webm')`);
  }
  
  // Search for CodecID (0x86)
  for (let i = 0; i < Math.min(bytes.length - 10, 5000); i++) {
    if (bytes[i] === 0x86) {
      const length = bytes[i + 1] & 0x7f;
      if (length > 0 && length < 50) {
        codecInfo = decoder.decode(bytes.slice(i + 2, i + 2 + length));
        break;
      }
    }
  }
  
  if (codecInfo === 'Unknown') {
    issues.push('Could not find codec information in file');
  } else if (!codecInfo.includes('opus') && !codecInfo.includes('vorbis')) {
    issues.push(`Unexpected codec: ${codecInfo} (expected opus or vorbis)`);
  }

  return {
    isValid: issues.length === 0 && hasWebMSignature,
    hasWebMSignature,
    signature,
    codecInfo,
    docType,
    fileSize: buffer.length,
    contentType: 'audio/webm',
    issues,
  };
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const { recordingId } = event.pathParameters || {};
    
    if (!recordingId) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: 'Recording ID is required' }),
      };
    }

    // Get recording metadata from DynamoDB
    const recordingResult = await docClient.send(
      new GetCommand({
        TableName: process.env.RECORDINGS_TABLE_NAME!,
        Key: { recordingId },
      })
    );

    if (!recordingResult.Item) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: 'Recording not found' }),
      };
    }

    const recording = recordingResult.Item;

    // Get first 10KB of the file from S3 for validation
    const getObjectCommand = new GetObjectCommand({
      Bucket: process.env.AUDIO_BUCKET_NAME!,
      Key: recording.s3Key,
      Range: 'bytes=0-10240', // First 10KB
    });

    const s3Response = await s3Client.send(getObjectCommand);
    const chunks: Uint8Array[] = [];
    
    if (s3Response.Body) {
      for await (const chunk of s3Response.Body as any) {
        chunks.push(chunk);
      }
    }
    
    const buffer = Buffer.concat(chunks);
    const validation = await validateWebMBuffer(buffer);
    
    // Add metadata from S3
    validation.contentType = s3Response.ContentType || 'unknown';
    validation.fileSize = recording.fileSize || 0;

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recordingId,
        s3Key: recording.s3Key,
        validation,
        metadata: {
          duration: recording.duration,
          createdAt: recording.createdAt,
          mimeType: recording.mimeType,
        },
      }),
    };
  } catch (error) {
    console.error('Error validating WebM:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        message: 'Failed to validate recording',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};