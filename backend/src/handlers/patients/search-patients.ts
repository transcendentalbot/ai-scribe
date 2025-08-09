import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { PatientSearchSchema } from '../../types/patient';
import { PatientService } from '../../services/patient.service';
import { errorHandler } from '../../middleware/error-handler';
import { validateQueryParams, getAuthToken } from '../../middleware/request-validator';
import { response } from '../../utils/response';
import { logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';
import { cognitoService } from '../../utils/cognito';
import { AuthorizationError } from '../../errors';

const dynamoClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const patientService = new PatientService(dynamodb, process.env.TABLE_NAME!);

const searchPatientsHandler = async (event: APIGatewayProxyEvent, context: Context) => {
  const startTime = Date.now();
  
  // Get provider ID from token
  const token = getAuthToken(event);
  const user = await cognitoService.getUser(token);
  const providerId = user.UserAttributes?.find(attr => attr.Name === 'custom:user_id')?.Value;
  
  if (!providerId) {
    throw new AuthorizationError('Provider ID not found');
  }

  // Validate query parameters
  const { query, limit, nextToken } = validateQueryParams(event, PatientSearchSchema);

  logger.info('Searching patients', {
    providerId,
    query,
    limit,
  });

  // Search patients
  const result = await patientService.searchPatients(query, Number(limit), nextToken);

  // Log PHI access
  logger.audit('PATIENT_SEARCH', providerId, 'SEARCH', {
    query,
    resultCount: result.patients.length,
    action: 'SEARCH',
  });

  // Track metrics
  metrics.success('SearchPatients');
  metrics.duration('SearchPatientsDuration', startTime);
  metrics.gauge('SearchResultCount', result.patients.length);

  return response.success({
    patients: result.patients,
    nextToken: result.nextToken,
  });
};

export const handler = errorHandler(searchPatientsHandler);