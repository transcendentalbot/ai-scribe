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
import { ClinicalNoteEntity, UpdateNoteSchema, NoteStatus } from '../../types/notes';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const PathParamsSchema = z.object({
  noteId: z.string().uuid(),
});

const updateNoteHandler = async (event: APIGatewayProxyEvent, context: Context) => {
  const startTime = Date.now();
  const requestId = context.awsRequestId;

  logger.info('[Update Note] Handler started', {
    requestId,
    path: event.path,
    method: event.httpMethod,
  });

  // Validate path parameters and body
  const { noteId } = validatePathParams(event, PathParamsSchema);
  const updateData = validateBody(event, UpdateNoteSchema);

  // Get user from token
  const { userId: providerId } = getUserFromToken(event);

  try {
    // First, get the existing note to check authorization and current status
    const getResult = await docClient.send(
      new GetCommand({
        TableName: process.env.TABLE_NAME,
        // We need to query by GSI1 to find the note
        // For now, using a simplified approach - in production, this would use GSI1 query
        Key: {
          pk: `NOTE#${noteId}`,
          sk: 'ENCOUNTER#', // This needs to match the actual SK pattern
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
      throw new ValidationError('Cannot modify a signed note');
    }

    // Prepare update expression and values
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    // Update sections if provided
    if (updateData.sections) {
      updateExpressions.push('#sections = :sections');
      expressionAttributeNames['#sections'] = 'sections';
      expressionAttributeValues[':sections'] = {
        ...existingNote.sections,
        ...updateData.sections,
      };
    }

    // Update codes if provided
    if (updateData.codes) {
      updateExpressions.push('#codes = :codes');
      expressionAttributeNames['#codes'] = 'codes';
      expressionAttributeValues[':codes'] = {
        ...existingNote.codes,
        ...updateData.codes,
      };
    }

    // Update status if provided
    if (updateData.status) {
      updateExpressions.push('#status = :status');
      expressionAttributeNames['#status'] = 'status';
      expressionAttributeValues[':status'] = updateData.status;
    }

    // Always update metadata
    const now = new Date().toISOString();
    updateExpressions.push('#metadata = :metadata');
    expressionAttributeNames['#metadata'] = 'metadata';
    expressionAttributeValues[':metadata'] = {
      ...existingNote.metadata,
      lastModified: now,
      modifiedBy: providerId,
    };

    // Add edit to audit trail
    updateExpressions.push('#audit = :audit');
    expressionAttributeNames['#audit'] = 'audit';
    expressionAttributeValues[':audit'] = {
      ...existingNote.audit,
      edits: [
        ...existingNote.audit.edits,
        {
          userId: providerId,
          timestamp: now,
          section: updateData.sections ? 'content' : updateData.codes ? 'codes' : 'status',
        },
      ],
    };

    // Perform the update
    const updateResult = await docClient.send(
      new UpdateCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
          pk: existingNote.pk,
          sk: existingNote.sk,
        },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
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
    logger.info('[Update Note] Note updated successfully', {
      noteId,
      providerId,
      status: note.status,
      updateType: updateData.sections ? 'sections' : updateData.codes ? 'codes' : 'status',
      duration,
      requestId,
    });

    return response.success({ note });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('[Update Note] Failed to update note', {
      noteId,
      providerId,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      requestId,
    });
    throw error;
  }
};

export const handler = errorHandler(updateNoteHandler);