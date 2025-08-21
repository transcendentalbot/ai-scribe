import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { errorHandler } from '../../middleware/error-handler';
import { validatePathParams } from '../../middleware/request-validator';
import { getUserFromToken } from '../../utils/jwt';
import { response } from '../../utils/response';
import { logger } from '../../utils/logger';
import { AuthorizationError } from '../../errors';
import { z } from 'zod';
import { ClinicalNoteEntity } from '../../types/notes';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const PathParamsSchema = z.object({
  noteId: z.string().uuid(),
});

const getNoteHistoryHandler = async (event: APIGatewayProxyEvent, context: Context) => {
  const startTime = Date.now();
  const requestId = context.awsRequestId;

  logger.info('[Get Note History] Handler started', {
    requestId,
    path: event.path,
    method: event.httpMethod,
  });

  // Validate path parameters
  const { noteId } = validatePathParams(event, PathParamsSchema);

  // Get user from token
  const { userId: providerId } = getUserFromToken(event);

  try {
    // Query all versions of the note using GSI1
    const result = await docClient.send(
      new QueryCommand({
        TableName: process.env.TABLE_NAME,
        IndexName: 'gsi1',
        KeyConditionExpression: 'gsi1pk = :noteId',
        ExpressionAttributeValues: {
          ':noteId': `NOTE#${noteId}`,
        },
        ScanIndexForward: false, // Most recent version first
        Limit: 10, // Last 10 versions as specified in PRP
      })
    );

    if (!result.Items || result.Items.length === 0) {
      return response.success({ versions: [] });
    }

    const noteEntities = result.Items as ClinicalNoteEntity[];

    // Check authorization - all versions should belong to the same provider
    const unauthorizedNote = noteEntities.find(note => 
      note.metadata.modifiedBy !== providerId
    );

    if (unauthorizedNote) {
      throw new AuthorizationError('Access denied to this note');
    }

    // Convert to API response format
    const versions = noteEntities.map(noteEntity => ({
      noteId: noteEntity.noteId,
      encounterId: noteEntity.encounterId,
      status: noteEntity.status,
      sections: noteEntity.sections,
      codes: noteEntity.codes,
      metadata: noteEntity.metadata,
      audit: noteEntity.audit,
    }));

    const duration = Date.now() - startTime;
    logger.info('[Get Note History] Note history retrieved successfully', {
      noteId,
      providerId,
      versionCount: versions.length,
      duration,
      requestId,
    });

    return response.success({ versions });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('[Get Note History] Failed to retrieve note history', {
      noteId,
      providerId,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      requestId,
    });
    throw error;
  }
};

export const handler = errorHandler(getNoteHistoryHandler);