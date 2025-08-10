import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DailyEncounterListSchema } from '../../types/encounter';
import { EncounterService } from '../../services/encounter.service';
import { PatientService } from '../../services/patient.service';
import { errorHandler } from '../../middleware/error-handler';
import { validateQueryParams, getAuthToken } from '../../middleware/request-validator';
import { response } from '../../utils/response';
import { logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';
import { cognitoService } from '../../utils/cognito';
import { AuthorizationError } from '../../errors';
import jwt from 'jsonwebtoken';

const dynamoClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const encounterService = new EncounterService(dynamodb, process.env.TABLE_NAME!);
const patientService = new PatientService(dynamodb, process.env.TABLE_NAME!);

const getDailyEncountersHandler = async (event: APIGatewayProxyEvent, context: Context) => {
  const startTime = Date.now();
  
  // Get provider ID from token
  const token = getAuthToken(event);
  
  // Decode the access token to get the user ID
  const decodedToken = jwt.decode(token) as any;
  const currentProviderId = decodedToken?.sub || decodedToken?.username;
  
  if (!currentProviderId) {
    throw new AuthorizationError('Provider ID not found in token');
  }

  // Validate query parameters
  const { date, providerId, status, limit, nextToken } = validateQueryParams(event, DailyEncounterListSchema);

  // Use current provider if not specified
  const targetProviderId = providerId || currentProviderId;
  
  // Use today's date if not specified
  const targetDate = date || new Date().toISOString().split('T')[0];

  logger.info('Getting daily encounters', {
    currentProviderId,
    targetProviderId,
    date: targetDate,
    status,
  });

  // Get encounters
  const result = await encounterService.getDailyEncounters(
    targetProviderId,
    targetDate,
    status,
    Number(limit),
    nextToken
  );

  // Get unique patient IDs
  const patientIds = [...new Set(result.encounters.map(e => e.patientId))];
  
  // Batch get patient information
  const patients = await patientService.getPatientsByIds(patientIds);
  const patientMap = new Map(patients.map(p => [p.id, p]));

  // Enrich encounters with patient data
  const enrichedEncounters = result.encounters.map(encounter => ({
    ...encounter,
    patient: patientMap.get(encounter.patientId) || null,
  }));

  // Log PHI access
  logger.audit('DAILY_ENCOUNTERS_ACCESSED', currentProviderId, targetDate, {
    providerId: targetProviderId,
    date: targetDate,
    count: result.encounters.length,
    action: 'LIST',
  });

  // Track metrics
  metrics.success('GetDailyEncounters');
  metrics.duration('GetDailyEncountersDuration', startTime);
  metrics.gauge('DailyEncounterCount', result.encounters.length);

  return response.success({
    date: targetDate,
    providerId: targetProviderId,
    encounters: enrichedEncounters,
    nextToken: result.nextToken,
    summary: {
      total: enrichedEncounters.length,
      byStatus: enrichedEncounters.reduce((acc, e) => {
        acc[e.status] = (acc[e.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    },
  });
};

export const handler = errorHandler(getDailyEncountersHandler);