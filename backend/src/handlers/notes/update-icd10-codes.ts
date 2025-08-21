import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { errorHandler } from '../../middleware/error-handler';
import { validatePathParams, validateBody } from '../../middleware/request-validator';
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

const UpdateICD10Schema = z.object({
  codes: z.array(z.object({
    code: z.string().min(1),
    description: z.string().min(1),
    confidence: z.number().min(0).max(1),
  })),
});

const updateICD10CodesHandler = async (event: APIGatewayProxyEvent, context: Context) => {
  const startTime = Date.now();
  const requestId = context.awsRequestId;

  logger.info('[Update ICD10 Codes] Handler started', {
    requestId,
    path: event.path,
    method: event.httpMethod,
  });

  // Validate path parameters and body
  const { noteId } = validatePathParams(event, PathParamsSchema);
  const { codes } = validateBody(event, UpdateICD10Schema);

  // Get user from token
  const { userId: providerId } = getUserFromToken(event);

  try {
    // First, get the existing note to check authorization and current status
    const getResult = await docClient.send(
      new GetCommand({
        TableName: process.env.TABLE_NAME,
        // This would use GSI1 in production to find by noteId
        Key: {
          pk: `NOTE#${noteId}`,
          sk: 'ENCOUNTER#', // This needs to match actual storage pattern
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

    // Check if note is signed (locked)
    if (existingNote.status === NoteStatus.SIGNED) {
      throw new ValidationError('Cannot modify codes on a signed note');
    }

    // Update the ICD-10 codes
    const now = new Date().toISOString();
    const updateResult = await docClient.send(
      new UpdateCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
          pk: existingNote.pk,
          sk: existingNote.sk,
        },
        UpdateExpression: `
          SET #codes.#icd10 = :icd10Codes,
              #metadata = :metadata,
              #audit = :audit
        `,
        ExpressionAttributeNames: {
          '#codes': 'codes',
          '#icd10': 'icd10',
          '#metadata': 'metadata',
          '#audit': 'audit',
        },
        ExpressionAttributeValues: {
          ':icd10Codes': codes,
          ':metadata': {
            ...existingNote.metadata,
            lastModified: now,
            modifiedBy: providerId,
          },
          ':audit': {
            ...existingNote.audit,
            edits: [
              ...existingNote.audit.edits,
              {
                userId: providerId,
                timestamp: now,
                section: 'icd10-codes',
              },
            ],
          },
        },
        ReturnValues: 'ALL_NEW',
      })
    );

    const updatedNote = updateResult.Attributes as ClinicalNoteEntity;

    // Convert to API response format
    const note = {
      noteId: updatedNote.noteId,
      encounterId: updatedNote.encounterId,
      status: updatedNote.status,
      sections: updatedNote.sections,
      codes: updatedNote.codes,
      metadata: updatedNote.metadata,
      audit: updatedNote.audit,
    };

    const duration = Date.now() - startTime;
    logger.info('[Update ICD10 Codes] ICD-10 codes updated successfully', {
      noteId,
      providerId,
      codeCount: codes.length,
      duration,
      requestId,
    });

    return response.success({ note });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('[Update ICD10 Codes] Failed to update ICD-10 codes', {
      noteId,
      providerId,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      requestId,
    });
    throw error;
  }
};

export const handler = errorHandler(updateICD10CodesHandler);