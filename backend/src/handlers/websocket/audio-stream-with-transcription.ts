import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { audioService } from '../../services/audio.service';
import { transcriptionService } from '../../services/transcription.service';

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
    const subAction = body.type || body.action;
    switch (subAction) {
      case 'start-recording': {
        const { encounterId, metadata, enableTranscription = true } = body;
        
        // Initialize recording session
        const audioSession = await audioService.startRecording({
          connectionId,
          encounterId,
          metadata,
        });

        let transcriptionSession = null;
        if (enableTranscription) {
          // Start transcription session
          transcriptionSession = await transcriptionService.startTranscription({
            connectionId,
            encounterId,
            metadata,
          });
        }

        // Update connection with recording and transcription info
        await docClient.send(
          new UpdateCommand({
            TableName: process.env.CONNECTIONS_TABLE_NAME!,
            Key: { connectionId },
            UpdateExpression: 'SET recordingSession = :recording, transcriptionSession = :transcription, #status = :status',
            ExpressionAttributeNames: {
              '#status': 'status',
            },
            ExpressionAttributeValues: {
              ':recording': audioSession,
              ':transcription': transcriptionSession,
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
              sessionId: audioSession.sessionId,
              transcriptionSessionId: transcriptionSession?.sessionId,
              uploadUrl: audioSession.uploadUrl,
              enableTranscription,
            }),
          })
        );
        break;
      }

      case 'audio-chunk': {
        const { sessionId, chunk, sequenceNumber, transcriptionSessionId } = body;
        
        try {
          // Process audio chunk for recording
          const result = await audioService.processAudioChunk({
            connectionId,
            sessionId,
            chunk,
            sequenceNumber,
          });
          
          // Check if recording was auto-stopped
          if (result.status === 'auto-stopped') {
            console.log(`[audio-chunk] Recording auto-stopped due to: ${result.reason}`);
            await apigwManagementApi.send(
              new PostToConnectionCommand({
                ConnectionId: connectionId,
                Data: JSON.stringify({
                  type: 'recording-auto-stopped',
                  reason: result.reason,
                  duration: result.duration,
                  sessionId,
                }),
              })
            );
            break;
          }

          // Process audio chunk for transcription if enabled
          let transcriptSegment = null;
          if (transcriptionSessionId) {
            try {
              transcriptSegment = await transcriptionService.processAudioChunk({
                sessionId: transcriptionSessionId,
                chunk,
                sequenceNumber,
              });

              // If we got a transcript segment, send it to the client
              if (transcriptSegment) {
                await apigwManagementApi.send(
                  new PostToConnectionCommand({
                    ConnectionId: connectionId,
                    Data: JSON.stringify({
                      type: 'transcript-segment',
                      segment: transcriptSegment,
                    }),
                  })
                );
              }
            } catch (transcriptionError) {
              console.error('[audio-chunk] Transcription error:', transcriptionError);
              // Continue processing even if transcription fails
            }
          }

          // Send acknowledgment
          await apigwManagementApi.send(
            new PostToConnectionCommand({
              ConnectionId: connectionId,
              Data: JSON.stringify({
                type: 'chunk-received',
                sequenceNumber,
                transcribed: !!transcriptSegment,
              }),
            })
          );
        } catch (chunkError: any) {
          // If session not found, it might be a late-arriving chunk after stop
          if (chunkError.message?.includes('Session not found')) {
            console.log(`[audio-chunk] Late chunk ignored for completed session: ${sessionId}, seq: ${sequenceNumber}`);
            // Still send acknowledgment to avoid client retries
            await apigwManagementApi.send(
              new PostToConnectionCommand({
                ConnectionId: connectionId,
                Data: JSON.stringify({
                  type: 'chunk-received',
                  sequenceNumber,
                  late: true,
                }),
              })
            );
          } else {
            // Re-throw other errors
            throw chunkError;
          }
        }
        break;
      }

      case 'stop-recording': {
        const { sessionId, transcriptionSessionId } = body;
        console.log(`[stop-recording] Processing stop for sessions:`, { sessionId, transcriptionSessionId });
        
        try {
          // Stop transcription first (if enabled)
          let transcriptionResult = null;
          if (transcriptionSessionId) {
            try {
              transcriptionResult = await transcriptionService.stopTranscription({
                sessionId: transcriptionSessionId,
              });
              console.log(`[stop-recording] Transcription stopped:`, transcriptionResult);
            } catch (transcriptionError) {
              console.error(`[stop-recording] Transcription stop error:`, transcriptionError);
            }
          }

          // Finalize recording
          const recordingResult = await audioService.stopRecording({
            connectionId,
            sessionId,
          });
          console.log(`[stop-recording] Recording finalized:`, recordingResult);

          // Update connection status
          await docClient.send(
            new UpdateCommand({
              TableName: process.env.CONNECTIONS_TABLE_NAME!,
              Key: { connectionId },
              UpdateExpression: 'SET #status = :status, recordingSession = :empty, transcriptionSession = :empty',
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
            recordingId: recordingResult.recordingId,
            duration: recordingResult.duration,
            s3Key: recordingResult.s3Key,
            transcriptionSessionId,
            transcriptCount: transcriptionResult?.transcriptCount || 0,
            transcriptionRecordingId: transcriptionResult?.recordingId,
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