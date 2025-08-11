import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const connectionId = event.requestContext.connectionId!;
  const timestamp = new Date().toISOString();

  console.log('WebSocket connection request:', {
    connectionId,
    sourceIp: event.requestContext.identity.sourceIp,
    userAgent: event.requestContext.identity.userAgent,
  });

  try {
    // Store connection in DynamoDB
    await docClient.send(
      new PutCommand({
        TableName: process.env.CONNECTIONS_TABLE_NAME!,
        Item: {
          connectionId,
          connectedAt: timestamp,
          ttl: Math.floor(Date.now() / 1000) + 3600, // 1 hour TTL
          status: 'connected',
          sourceIp: event.requestContext.identity.sourceIp,
          userAgent: event.requestContext.identity.userAgent,
        },
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Connected successfully' }),
    };
  } catch (error) {
    console.error('Error storing connection:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to connect' }),
    };
  }
};