import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { response } from '../../utils/response';
import { getUserFromToken } from '../../utils/jwt';

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

    // Query transcription segments for the encounter
    const result = await docClient.send(
      new QueryCommand({
        TableName: process.env.TABLE_NAME!,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
        ExpressionAttributeValues: {
          ':pk': `ENCOUNTER#${encounterId}`,
          ':sk': 'TRANSCRIPT#',
        },
        ScanIndexForward: true, // Chronological order
      })
    );

    const transcriptions = (result.Items || []).map(item => ({
      timestamp: parseInt(item.timestamp),
      text: item.text,
      speaker: item.speaker || 'Unknown',
      confidence: item.confidence,
      entities: item.entities || [],
      isPartial: item.isPartial || false,
    }));

    return response.success({
      encounterId,
      transcriptions,
      count: transcriptions.length,
    });
  } catch (error) {
    console.error('Error retrieving transcriptions:', error);
    return response.error('Internal server error', 500);
  }
};