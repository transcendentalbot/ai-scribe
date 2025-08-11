import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { UpdateEncounterStatusSchema } from '../../types/encounter';
import { EncounterService } from '../../services/encounter.service';
import { errorHandler } from '../../middleware/error-handler';
import { validateBody, validatePathParams } from '../../middleware/request-validator';
import { response } from '../../utils/response';
import { logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';
import { getProviderIdFromToken } from '../../utils/jwt';
import { AuthorizationError, NotFoundError } from '../../errors';

const dynamoClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const encounterService = new EncounterService(dynamodb, process.env.TABLE_NAME!);

const PathParamsSchema = z.object({
  encounterId: z.string().uuid(),
});

const updateEncounterStatusHandler = async (event: APIGatewayProxyEvent, context: Context) => {
  const startTime = Date.now();
  
  // Get provider ID from token
  const providerId = getProviderIdFromToken(event);

  // Validate path parameters
  const { encounterId } = validatePathParams(event, PathParamsSchema);

  // Validate request body
  const statusUpdate = validateBody(event, UpdateEncounterStatusSchema);

  logger.info('Updating encounter status', {
    providerId,
    encounterId,
    newStatus: statusUpdate.status,
  });

  // Get current encounter to check authorization
  const currentEncounter = await encounterService.getEncounter(encounterId);
  if (!currentEncounter) {
    throw new NotFoundError('Encounter');
  }

  // Only the assigned provider can update the encounter
  if (currentEncounter.providerId !== providerId) {
    throw new AuthorizationError('You can only update your own encounters');
  }

  // Update status
  const encounter = await encounterService.updateEncounterStatus(
    encounterId,
    statusUpdate,
    providerId
  );

  // Log PHI access
  logger.audit('ENCOUNTER_STATUS_UPDATED', providerId, encounter.id, {
    patientId: encounter.patientId,
    fromStatus: currentEncounter.status,
    toStatus: statusUpdate.status,
    action: 'UPDATE_STATUS',
  });

  // Track metrics
  metrics.success('UpdateEncounterStatus');
  metrics.duration('UpdateEncounterStatusDuration', startTime);

  return response.success({
    encounter,
  });
};

export const handler = errorHandler(updateEncounterStatusHandler);