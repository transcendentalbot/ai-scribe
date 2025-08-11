import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { audioService } from '../../services/audio.service';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const connectionId = event.requestContext.connectionId!;
  const routeKey = event.requestContext.routeKey;
  
  // Create API Gateway Management API client
  const apigwManagementApi = new ApiGatewayManagementApiClient({
    endpoint: `https://${event.requestContext.domainName}/${event.requestContext.stage}`,
  });

  try {
    const body = JSON.parse(event.body || '{}');

    // Verify connection exists
    const connectionResult = await docClient.send(
      new GetCommand({
        TableName: process.env.CONNECTIONS_TABLE_NAME!,
        Key: { connectionId },
      })
    );

    if (!connectionResult.Item) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Connection not found' }),
      };
    }

    // Handle different audio stream actions
    // The 'action' field is used for routing, so we use 'type' for the sub-action
    const subAction = body.type || body.action;
    switch (subAction) {
      case 'start-recording': {
        const { encounterId, metadata } = body;
        
        // Initialize recording session
        const session = await audioService.startRecording({
          connectionId,
          encounterId,
          metadata,
        });

        // Update connection with recording info
        await docClient.send(
          new UpdateCommand({
            TableName: process.env.CONNECTIONS_TABLE_NAME!,
            Key: { connectionId },
            UpdateExpression: 'SET recordingSession = :session, #status = :status',
            ExpressionAttributeNames: {
              '#status': 'status',
            },
            ExpressionAttributeValues: {
              ':session': session,
              ':status': 'recording',
            },
          })
        );

        // Send confirmation back to client
        await apigwManagementApi.send(
          new PostToConnectionCommand({
            ConnectionId: connectionId,
            Data: JSON.stringify({
              type: 'recording-started',
              sessionId: session.sessionId,
              uploadUrl: session.uploadUrl,
            }),
          })
        );
        break;
      }

      case 'audio-chunk': {
        const { sessionId, chunk, sequenceNumber } = body;
        
        // Process audio chunk
        await audioService.processAudioChunk({
          connectionId,
          sessionId,
          chunk,
          sequenceNumber,
        });

        // Send acknowledgment
        await apigwManagementApi.send(
          new PostToConnectionCommand({
            ConnectionId: connectionId,
            Data: JSON.stringify({
              type: 'chunk-received',
              sequenceNumber,
            }),
          })
        );
        break;
      }

      case 'stop-recording': {
        const { sessionId } = body;
        console.log(`[stop-recording] Processing stop for session: ${sessionId}, connection: ${connectionId}`);
        
        try {
          // Finalize recording
          const result = await audioService.stopRecording({
            connectionId,
            sessionId,
          });
          console.log(`[stop-recording] Recording finalized:`, result);

          // Update connection status
          await docClient.send(
            new UpdateCommand({
              TableName: process.env.CONNECTIONS_TABLE_NAME!,
              Key: { connectionId },
              UpdateExpression: 'SET #status = :status, recordingSession = :empty',
              ExpressionAttributeNames: {
                '#status': 'status',
              },
              ExpressionAttributeValues: {
                ':status': 'connected',
                ':empty': null,
              },
            })
          );
          console.log(`[stop-recording] Connection status updated`);

          // Send completion notification
          const responseData = {
            type: 'recording-stopped',
            sessionId,
            recordingId: result.recordingId,
            duration: result.duration,
            s3Key: result.s3Key,
          };
          console.log(`[stop-recording] Sending response:`, responseData);
          
          await apigwManagementApi.send(
            new PostToConnectionCommand({
              ConnectionId: connectionId,
              Data: JSON.stringify(responseData),
            })
          );
          console.log(`[stop-recording] Response sent successfully`);
        } catch (error) {
          console.error(`[stop-recording] Error processing stop:`, error);
          throw error;
        }
        break;
      }

      case 'pause-recording':
      case 'resume-recording': {
        const { sessionId } = body;
        const isPaused = subAction === 'pause-recording';
        
        await audioService.updateRecordingStatus({
          connectionId,
          sessionId,
          isPaused,
        });

        await apigwManagementApi.send(
          new PostToConnectionCommand({
            ConnectionId: connectionId,
            Data: JSON.stringify({
              type: isPaused ? 'recording-paused' : 'recording-resumed',
              sessionId,
            }),
          })
        );
        break;
      }

      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ message: 'Invalid action' }),
        };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Success' }),
    };
  } catch (error) {
    console.error('Error processing audio stream:', error);
    
    // Send error notification to client
    try {
      await apigwManagementApi.send(
        new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: JSON.stringify({
            type: 'error',
            message: 'Failed to process audio stream',
          }),
        })
      );
    } catch (notifyError) {
      console.error('Failed to notify client of error:', notifyError);
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
};