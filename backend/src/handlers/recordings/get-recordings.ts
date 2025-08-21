import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { response } from '../../utils/response';
import { getUserFromToken } from '../../utils/jwt';

const s3Client = new S3Client({});
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Verify authorization
    const user = getUserFromToken(event);

    const encounterId = event.pathParameters?.encounterId;
    if (!encounterId) {
      return response.error('Encounter ID is required', 400);
    }

    // Query encounter metadata to get recordings
    const encounterResult = await docClient.send(
      new QueryCommand({
        TableName: process.env.TABLE_NAME!,
        KeyConditionExpression: 'pk = :pk AND sk = :sk',
        ExpressionAttributeValues: {
          ':pk': `ENCOUNTER#${encounterId}`,
          ':sk': 'METADATA',
        },
      })
    );

    if (!encounterResult.Items || encounterResult.Items.length === 0) {
      return response.error('Encounter not found', 404);
    }

    const encounter = encounterResult.Items[0];
    const recordings = encounter.recordings || [];

    // Generate presigned URLs for each recording
    const recordingsWithUrls = await Promise.all(
      recordings.map(async (recording: any) => {
        try {
          // Determine content type based on file extension
          let contentType = 'audio/webm;codecs=opus';
          if (recording.s3Key.endsWith('.mp4')) {
            contentType = 'audio/mp4';
          } else if (recording.s3Key.endsWith('.ogg')) {
            contentType = 'audio/ogg;codecs=opus';
          }
          
          console.log('[Get Recordings] Generating presigned URL:', {
            recordingId: recording.recordingId,
            s3Key: recording.s3Key,
            bucket: process.env.AUDIO_BUCKET_NAME,
            contentType: contentType,
            mimeType: recording.mimeType,
            fileSize: recording.fileSize,
          });
          
          // Generate presigned URL for download/playback
          // Note: Removed ResponseContentType and ResponseContentDisposition to avoid signature issues
          const presignedUrl = await getSignedUrl(
            s3Client,
            new GetObjectCommand({
              Bucket: process.env.AUDIO_BUCKET_NAME!,
              Key: recording.s3Key,
            }),
            { expiresIn: 3600 } // 1 hour expiration
          );
          
          console.log('[Get Recordings] Generated URL:', {
            recordingId: recording.recordingId,
            urlPreview: presignedUrl.substring(0, 100) + '...',
          });

          // Check if this is a PCM file that needs conversion for playback
          const isPCM = recording.s3Key.endsWith('.pcm') || recording.s3Key.endsWith('.raw');
          
          return {
            ...recording,
            url: presignedUrl,
            isPlayable: !isPCM,  // PCM files cannot be played directly in browsers
            needsConversion: isPCM,
            debugInfo: {
              generatedContentType: contentType,
              originalMimeType: recording.mimeType,
              s3Key: recording.s3Key,
              isPCM: isPCM,
            }
          };
        } catch (error) {
          console.error('[Get Recordings] Error generating presigned URL:', {
            recordingId: recording.recordingId,
            error: error instanceof Error ? error.message : error,
          });
          return {
            ...recording,
            url: null,
            error: 'Failed to generate download URL',
          };
        }
      })
    );

    return response.success({
      encounterId,
      recordings: recordingsWithUrls,
    });
  } catch (error) {
    console.error('Error retrieving recordings:', error);
    return response.error('Internal server error', 500);
  }
};