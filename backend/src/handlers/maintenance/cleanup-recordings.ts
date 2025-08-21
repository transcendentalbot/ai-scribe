import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Lambda handler to clean up orphaned recording sessions
 * This should be run periodically (e.g., every hour via CloudWatch Events)
 */
export const handler = async () => {
  const connectionsTable = process.env.CONNECTIONS_TABLE_NAME!;
  const maxAgeMinutes = 10; // Sessions older than 10 minutes are considered orphaned
  const cutoffTime = Date.now() - (maxAgeMinutes * 60 * 1000);

  try {
    // Scan for recording sessions
    const scanResult = await docClient.send(
      new ScanCommand({
        TableName: connectionsTable,
        FilterExpression: 'begins_with(connectionId, :prefix) AND #ts < :cutoff',
        ExpressionAttributeNames: {
          '#ts': 'timestamp',
        },
        ExpressionAttributeValues: {
          ':prefix': 'SESSION#',
          ':cutoff': cutoffTime,
        },
      })
    );

    const orphanedSessions = scanResult.Items || [];
    console.log(`Found ${orphanedSessions.length} orphaned recording sessions`);

    // Delete orphaned sessions
    const deletePromises = orphanedSessions.map(async (session) => {
      try {
        const sessionData = JSON.parse(session.sessionData);
        console.log(`Cleaning up orphaned session: ${sessionData.sessionId}, started: ${sessionData.startTime}`);
        
        await docClient.send(
          new DeleteCommand({
            TableName: connectionsTable,
            Key: {
              connectionId: session.connectionId,
            },
          })
        );
        
        return { sessionId: sessionData.sessionId, status: 'deleted' };
      } catch (error) {
        console.error(`Failed to delete session ${session.connectionId}:`, error);
        return { sessionId: session.connectionId, status: 'error', error };
      }
    });

    const results = await Promise.all(deletePromises);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Cleanup completed',
        sessionsProcessed: orphanedSessions.length,
        results,
      }),
    };
  } catch (error) {
    console.error('Cleanup error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Cleanup failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};