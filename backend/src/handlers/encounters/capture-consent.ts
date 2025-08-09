import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { CaptureConsentSchema } from '../../types/encounter';
import { EncounterService } from '../../services/encounter.service';
import { errorHandler } from '../../middleware/error-handler';
import { validateBody, validatePathParams, getAuthToken } from '../../middleware/request-validator';
import { response } from '../../utils/response';
import { logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';
import { cognitoService } from '../../utils/cognito';
import { AuthorizationError, NotFoundError } from '../../errors';

const dynamoClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const encounterService = new EncounterService(dynamodb, process.env.TABLE_NAME!);

const PathParamsSchema = z.object({
  encounterId: z.string().uuid(),
});

const captureConsentHandler = async (event: APIGatewayProxyEvent, context: Context) => {
  const startTime = Date.now();
  
  // Get provider ID from token
  const token = getAuthToken(event);
  const user = await cognitoService.getUser(token);
  const providerId = user.UserAttributes?.find(attr => attr.Name === 'custom:user_id')?.Value;
  
  if (!providerId) {
    throw new AuthorizationError('Provider ID not found');
  }

  // Validate path parameters
  const { encounterId } = validatePathParams(event, PathParamsSchema);

  // Validate request body
  const consentData = validateBody(event, CaptureConsentSchema);

  logger.info('Capturing consent', {
    providerId,
    encounterId,
    consentType: consentData.type,
    granted: consentData.granted,
  });

  // Get encounter to verify it exists and get patient ID
  const currentEncounter = await encounterService.getEncounter(encounterId);
  if (!currentEncounter) {
    throw new NotFoundError('Encounter');
  }

  // Only the assigned provider can capture consent
  if (currentEncounter.providerId !== providerId) {
    throw new AuthorizationError('You can only capture consent for your own encounters');
  }

  // Capture consent
  const encounter = await encounterService.captureConsent(
    encounterId,
    consentData,
    currentEncounter.patientId, // Patient is granting consent
    providerId
  );

  // Track metrics
  metrics.success('CaptureConsent');
  metrics.duration('CaptureConsentDuration', startTime);
  metrics.count('ConsentType', 1, 'Count', { 
    Type: consentData.type,
    Granted: consentData.granted.toString(),
  });

  return response.success({
    encounter,
    message: `Consent for ${consentData.type} has been ${consentData.granted ? 'granted' : 'denied'}`,
  });
};

export const handler = errorHandler(captureConsentHandler);