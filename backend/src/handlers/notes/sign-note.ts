import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { errorHandler } from '../../middleware/error-handler';
import { validatePathParams } from '../../middleware/request-validator';
import { getUserFromToken } from '../../utils/jwt';
import { response } from '../../utils/response';
import { logger } from '../../utils/logger';
import { NotFoundError, AuthorizationError, ValidationError } from '../../errors';
import { z } from 'zod';
import { ClinicalNoteEntity, NoteStatus } from '../../types/notes';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const PathParamsSchema = z.object({
  noteId: z.string().uuid(),
});

const signNoteHandler = async (event: APIGatewayProxyEvent, context: Context) => {
  const startTime = Date.now();
  const requestId = context.awsRequestId;

  logger.info('[Sign Note] Handler started', {
    requestId,
    path: event.path,
    method: event.httpMethod,
  });

  // Validate path parameters
  const { noteId } = validatePathParams(event, PathParamsSchema);

  // Get user from token
  const { userId: providerId } = getUserFromToken(event);

  try {
    // First, get the existing note to check authorization and current status
    const getResult = await docClient.send(
      new GetCommand({
        TableName: process.env.TABLE_NAME,
        // Using GSI1 to find note by noteId
        // This is a simplified approach - in production, we'd query GSI1
        Key: {
          pk: `NOTE#${noteId}`,
          sk: 'ENCOUNTER#', // This needs to match the actual storage pattern
        },
      })
    );

    if (!getResult.Item) {
      throw new NotFoundError(`Note ${noteId} not found`);
    }

    const existingNote = getResult.Item as ClinicalNoteEntity;

    // Check authorization
    if (existingNote.metadata.modifiedBy !== providerId) {
      throw new AuthorizationError('Access denied to this note');
    }

    // Check if note is already signed
    if (existingNote.status === NoteStatus.SIGNED) {
      throw new ValidationError('Note is already signed');
    }

    // Validate that required sections are completed
    const { sections } = existingNote;
    if (!sections.chiefComplaint || !sections.assessment || !sections.subjective.hpi) {
      throw new ValidationError('Required sections must be completed before signing');
    }

    // Sign the note
    const now = new Date().toISOString();
    const updateResult = await docClient.send(
      new UpdateCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
          pk: existingNote.pk,
          sk: existingNote.sk,
        },
        UpdateExpression: `
          SET #status = :status, 
              #metadata = :metadata,
              #audit = :audit
        `,
        ExpressionAttributeNames: {
          '#status': 'status',
          '#metadata': 'metadata',
          '#audit': 'audit',
        },
        ExpressionAttributeValues: {
          ':status': NoteStatus.SIGNED,
          ':metadata': {
            ...existingNote.metadata,
            lastModified: now,
            modifiedBy: providerId,
          },
          ':audit': {
            ...existingNote.audit,
            signed: {
              userId: providerId,
              timestamp: now,
            },
            edits: [
              ...existingNote.audit.edits,
              {
                userId: providerId,
                timestamp: now,
                section: 'signature',
              },
            ],
          },
        },
        ReturnValues: 'ALL_NEW',
        ConditionExpression: '#status <> :signedStatus', // Prevent double-signing
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':signedStatus': NoteStatus.SIGNED,
        },
      })
    );

    const signedNote = updateResult.Attributes as ClinicalNoteEntity;

    // Convert to API response format
    const note = {
      noteId: signedNote.noteId,
      encounterId: signedNote.encounterId,
      status: signedNote.status,
      sections: signedNote.sections,
      codes: signedNote.codes,
      metadata: signedNote.metadata,
      audit: signedNote.audit,
    };

    // Log the signing action for audit purposes
    logger.audit('NOTE_SIGNED', providerId, noteId, {
      encounterId: note.encounterId,
      signedAt: now,
      action: 'SIGN',
    });

    const duration = Date.now() - startTime;
    logger.info('[Sign Note] Note signed successfully', {
      noteId,
      providerId,
      encounterId: note.encounterId,
      signedAt: now,
      duration,
      requestId,
    });

    return response.success({ note });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('[Sign Note] Failed to sign note', {
      noteId,
      providerId,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      requestId,
    });
    throw error;
  }
};

export const handler = errorHandler(signNoteHandler);