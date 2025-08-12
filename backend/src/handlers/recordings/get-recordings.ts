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

    const encounterId = event.pathParameters?.id;
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
          // Generate presigned URL for download/playback
          const presignedUrl = await getSignedUrl(
            s3Client,
            new GetObjectCommand({
              Bucket: process.env.AUDIO_BUCKET_NAME!,
              Key: recording.s3Key,
            }),
            { expiresIn: 3600 } // 1 hour expiration
          );

          return {
            ...recording,
            url: presignedUrl,
          };
        } catch (error) {
          console.error(`Failed to generate URL for recording ${recording.id}:`, error);
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