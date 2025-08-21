import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { errorHandler } from '../../middleware/error-handler';
import { validatePathParams, getAuthToken } from '../../middleware/request-validator';
import { getUserFromToken } from '../../utils/jwt';
import { response } from '../../utils/response';
import { logger } from '../../utils/logger';
import { NotFoundError, AuthorizationError } from '../../errors';
import { z } from 'zod';
import { ClinicalNoteEntity } from '../../types/notes';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const PathParamsSchema = z.object({
  noteId: z.string().uuid(),
});

const getNoteHandler = async (event: APIGatewayProxyEvent, context: Context) => {
  const startTime = Date.now();
  const requestId = context.awsRequestId;

  logger.info('[Get Note] Handler started', {
    requestId,
    path: event.path,
    method: event.httpMethod,
  });

  // Validate path parameters
  const { noteId } = validatePathParams(event, PathParamsSchema);

  // Get user from token
  const { userId: providerId } = getUserFromToken(event);

  try {
    // Get note from DynamoDB using GSI1 (NOTE#noteId -> ENCOUNTER#encounterId)
    const result = await docClient.send(
      new QueryCommand({
        TableName: process.env.TABLE_NAME,
        IndexName: 'gsi1',
        KeyConditionExpression: 'gsi1pk = :noteId',
        ExpressionAttributeValues: {
          ':noteId': `NOTE#${noteId}`,
        },
        Limit: 1,
      })
    );

    if (!result.Items || result.Items.length === 0) {
      throw new NotFoundError(`Note ${noteId} not found`);
    }

    const noteEntity = result.Items[0] as ClinicalNoteEntity;

    // Check authorization - provider can only access their own notes
    if (noteEntity.metadata.modifiedBy !== providerId) {
      throw new AuthorizationError('Access denied to this note');
    }

    // Convert DynamoDB entity to API response
    const note = {
      noteId: noteEntity.noteId,
      encounterId: noteEntity.encounterId,
      status: noteEntity.status,
      sections: noteEntity.sections,
      codes: noteEntity.codes,
      metadata: noteEntity.metadata,
      audit: noteEntity.audit,
    };

    const duration = Date.now() - startTime;
    logger.info('[Get Note] Note retrieved successfully', {
      noteId,
      providerId,
      status: note.status,
      duration,
      requestId,
    });

    return response.success({ note });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('[Get Note] Failed to retrieve note', {
      noteId,
      providerId,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      requestId,
    });
    throw error;
  }
};

export const handler = errorHandler(getNoteHandler);