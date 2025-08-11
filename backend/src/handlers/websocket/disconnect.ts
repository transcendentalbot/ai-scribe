import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const connectionId = event.requestContext.connectionId!;

  console.log('WebSocket disconnection:', { connectionId });

  try {
    // Remove connection from DynamoDB
    await docClient.send(
      new DeleteCommand({
        TableName: process.env.CONNECTIONS_TABLE_NAME!,
        Key: { connectionId },
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Disconnected successfully' }),
    };
  } catch (error) {
    console.error('Error removing connection:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to disconnect' }),
    };
  }
};