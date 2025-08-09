import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { PatientService } from '../../services/patient.service';
import { errorHandler } from '../../middleware/error-handler';
import { validatePathParams, getAuthToken } from '../../middleware/request-validator';
import { response } from '../../utils/response';
import { logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';
import { cognitoService } from '../../utils/cognito';
import { NotFoundError, AuthorizationError } from '../../errors';

const dynamoClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const patientService = new PatientService(dynamodb, process.env.TABLE_NAME!);

const PathParamsSchema = z.object({
  patientId: z.string().uuid(),
});

const getPatientHandler = async (event: APIGatewayProxyEvent, context: Context) => {
  const startTime = Date.now();
  
  // Get provider ID from token
  const token = getAuthToken(event);
  const user = await cognitoService.getUser(token);
  const providerId = user.UserAttributes?.find(attr => attr.Name === 'custom:user_id')?.Value;
  
  if (!providerId) {
    throw new AuthorizationError('Provider ID not found');
  }

  // Validate path parameters
  const { patientId } = validatePathParams(event, PathParamsSchema);

  logger.info('Getting patient', {
    providerId,
    patientId,
  });

  // Get patient
  const patient = await patientService.getPatient(patientId);
  
  if (!patient) {
    throw new NotFoundError('Patient');
  }

  // Log PHI access
  logger.audit('PATIENT_ACCESSED', providerId, patient.id, {
    action: 'READ',
  });

  // Track metrics
  metrics.success('GetPatient');
  metrics.duration('GetPatientDuration', startTime);
  metrics.phiAccess(providerId, 'Patient', 'Read');

  return response.success({
    patient,
  });
};

export const handler = errorHandler(getPatientHandler);