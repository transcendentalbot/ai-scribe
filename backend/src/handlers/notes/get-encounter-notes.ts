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
  encounterId: z.string().uuid(),
});

const getEncounterNotesHandler = async (event: APIGatewayProxyEvent, context: Context) => {
  const startTime = Date.now();
  const requestId = context.awsRequestId;

  logger.info('[Get Encounter Notes] Handler started', {
    requestId,
    path: event.path,
    method: event.httpMethod,
  });

  // Validate path parameters
  const { encounterId } = validatePathParams(event, PathParamsSchema);

  // Get user from token
  const { userId: providerId } = getUserFromToken(event);

  try {
    // Query notes for the encounter
    const result = await docClient.send(
      new QueryCommand({
        TableName: process.env.TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
        ExpressionAttributeValues: {
          ':pk': `ENCOUNTER#${encounterId}`,
          ':sk': 'NOTE#',
        },
        ScanIndexForward: false, // Most recent first
      })
    );

    if (!result.Items) {
      return response.success({ notes: [] });
    }

    // Filter notes by provider (authorization check)
    const noteEntities = result.Items as ClinicalNoteEntity[];
    const authorizedNotes = noteEntities.filter(note => 
      note.metadata.modifiedBy === providerId
    );

    // Convert to API response format
    const notes = authorizedNotes.map(noteEntity => ({
      noteId: noteEntity.noteId,
      encounterId: noteEntity.encounterId,
      status: noteEntity.status,
      sections: noteEntity.sections,
      codes: noteEntity.codes,
      metadata: noteEntity.metadata,
      audit: noteEntity.audit,
    }));

    const duration = Date.now() - startTime;
    logger.info('[Get Encounter Notes] Notes retrieved successfully', {
      encounterId,
      providerId,
      noteCount: notes.length,
      duration,
      requestId,
    });

    return response.success({ notes });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('[Get Encounter Notes] Failed to retrieve notes', {
      encounterId,
      providerId,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      requestId,
    });
    throw error;
  }
};

export const handler = errorHandler(getEncounterNotesHandler);