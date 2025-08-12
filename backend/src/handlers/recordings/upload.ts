import { APIGatewayProxyHandler } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { response } from '../../utils/response';
import { getUserFromToken } from '../../utils/jwt';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const BUCKET_NAME = process.env.RECORDINGS_BUCKET || 'ai-scribe-recordings';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // Get user from token (API Gateway has already verified it)
    const user = getUserFromToken(event);

    // For now, return a presigned URL for direct upload
    const body = JSON.parse(event.body || '{}');
    const { encounterId, filename } = body;
    
    if (!encounterId || !filename) {
      return response.error('Missing encounterId or filename', 400);
    }

    // Create S3 key
    const recordingId = uuidv4();
    const s3Key = `recordings/${encounterId}/${recordingId}/${filename}`;

    // Generate presigned URL for PUT
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      ContentType: 'audio/webm',
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    return response.success({
      presignedUrl,
      s3Key,
      recordingId,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return response.error('Failed to generate upload URL', 500);
  }
};