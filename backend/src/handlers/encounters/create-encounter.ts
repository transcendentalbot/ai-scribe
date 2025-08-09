import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { CreateEncounterSchema } from '../../types/encounter';
import { EncounterService } from '../../services/encounter.service';
import { PatientService } from '../../services/patient.service';
import { errorHandler } from '../../middleware/error-handler';
import { validateBody, getAuthToken } from '../../middleware/request-validator';
import { response } from '../../utils/response';
import { logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';
import { cognitoService } from '../../utils/cognito';
import { AuthorizationError, NotFoundError } from '../../errors';

const dynamoClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const encounterService = new EncounterService(dynamodb, process.env.TABLE_NAME!);
const patientService = new PatientService(dynamodb, process.env.TABLE_NAME!);

const createEncounterHandler = async (event: APIGatewayProxyEvent, context: Context) => {
  const startTime = Date.now();
  
  // Get provider ID from token
  const token = getAuthToken(event);
  const user = await cognitoService.getUser(token);
  const providerId = user.UserAttributes?.find(attr => attr.Name === 'custom:user_id')?.Value;
  
  if (!providerId) {
    throw new AuthorizationError('Provider ID not found');
  }

  // Validate request body
  const encounterData = validateBody(event, CreateEncounterSchema);

  logger.info('Creating encounter', {
    providerId,
    patientId: encounterData.patientId,
    scheduledAt: encounterData.scheduledAt,
  });

  // Verify patient exists
  const patient = await patientService.getPatient(encounterData.patientId);
  if (!patient) {
    throw new NotFoundError('Patient');
  }

  // Create encounter
  const encounter = await encounterService.createEncounter(encounterData, providerId);

  // Log PHI access
  logger.audit('ENCOUNTER_CREATED', providerId, encounter.id, {
    patientId: encounter.patientId,
    action: 'CREATE',
  });

  // Track metrics
  metrics.success('CreateEncounter');
  metrics.duration('CreateEncounterDuration', startTime);
  metrics.count('EncounterType', 1, 'Count', { Type: encounter.type });

  return response.success({
    encounter,
  }, 201);
};

export const handler = errorHandler(createEncounterHandler);