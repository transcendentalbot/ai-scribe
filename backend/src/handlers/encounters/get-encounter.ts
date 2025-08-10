import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { EncounterService } from '../../services/encounter.service';
import { PatientService } from '../../services/patient.service';
import { errorHandler } from '../../middleware/error-handler';
import { response } from '../../utils/response';
import { logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';
import { AuthorizationError, NotFoundError } from '../../errors';
import jwt from 'jsonwebtoken';

const dynamoClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const encounterService = new EncounterService(dynamodb, process.env.TABLE_NAME!);
const patientService = new PatientService(dynamodb, process.env.TABLE_NAME!);

const getEncounterHandler = async (event: APIGatewayProxyEvent, context: Context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  const startTime = Date.now();

  const encounterId = event.pathParameters?.encounterId;
  if (!encounterId) {
    return response.error('Encounter ID is required', 400);
  }

  // Get provider ID from token
  const authHeader = event.headers.Authorization || event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthorizationError('No authorization token provided');
  }

  const token = authHeader.split(' ')[1];
  const decodedToken = jwt.decode(token) as any;
  const providerId = decodedToken?.sub || decodedToken?.username;
  
  if (!providerId) {
    throw new AuthorizationError('Invalid token: no provider ID');
  }

  logger.info('Getting encounter', { encounterId, providerId });

  // Get encounter
  const encounter = await encounterService.getEncounter(encounterId);
  
  if (!encounter) {
    throw new NotFoundError('Encounter not found');
  }

  // Check if provider has access to this encounter
  if (encounter.providerId !== providerId) {
    logger.warn('Access denied to encounter', { 
      encounterId, 
      requestingProviderId: providerId, 
      encounterProviderId: encounter.providerId 
    });
    throw new AuthorizationError('You do not have access to this encounter');
  }

  // Get patient details
  const patient = await patientService.getPatient(encounter.patientId);
  
  // Add patient to encounter response
  const encounterWithPatient = {
    ...encounter,
    patient,
  };

  // Track metrics
  metrics.success('GetEncounter');
  metrics.duration('GetEncounterDuration', startTime);

  return response.success({
    encounter: encounterWithPatient,
  });
};

export const handler = errorHandler(getEncounterHandler);