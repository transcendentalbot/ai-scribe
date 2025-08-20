import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { response } from '../../utils/response';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const encounterId = event.pathParameters?.encounterId;
    const body = JSON.parse(event.body || '{}');
    const { timestamp, speaker } = body;

    if (!encounterId || !timestamp || !speaker) {
      return response.error('Encounter ID, timestamp, and speaker are required', 400);
    }

    console.log(`[update-speaker] Updating speaker for encounter: ${encounterId}, timestamp: ${timestamp}, speaker: ${speaker}`);

    await docClient.send(
      new UpdateCommand({
        TableName: process.env.TABLE_NAME!,
        Key: {
          pk: `ENCOUNTER#${encounterId}`,
          sk: `TRANSCRIPT#${timestamp}`,
        },
        UpdateExpression: 'SET speaker = :speaker',
        ExpressionAttributeValues: {
          ':speaker': speaker,
        },
      })
    );

    console.log(`[update-speaker] Successfully updated speaker`);

    return response.success({
      message: 'Speaker updated successfully',
      encounterId,
      timestamp,
      speaker,
    });
  } catch (error) {
    console.error('[update-speaker] Error:', error);
    return response.error('Failed to update speaker', 500);
  }
};