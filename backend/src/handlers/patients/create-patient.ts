import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { CreatePatientSchema } from '../../types/patient';
import { PatientService } from '../../services/patient.service';
import { errorHandler } from '../../middleware/error-handler';
import { validateBody, getAuthToken } from '../../middleware/request-validator';
import { response } from '../../utils/response';
import { logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';
import { cognitoService } from '../../utils/cognito';
import { AuthorizationError } from '../../errors';

const dynamoClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const patientService = new PatientService(dynamodb, process.env.TABLE_NAME!);

const createPatientHandler = async (event: APIGatewayProxyEvent, context: Context) => {
  const startTime = Date.now();
  
  // Get provider ID from token
  const token = getAuthToken(event);
  const user = await cognitoService.getUser(token);
  const providerId = user.UserAttributes?.find(attr => attr.Name === 'custom:user_id')?.Value;
  
  if (!providerId) {
    throw new AuthorizationError('Provider ID not found');
  }

  // Validate request body
  const patientData = validateBody(event, CreatePatientSchema);

  logger.info('Creating patient', {
    providerId,
    mrn: patientData.mrn,
  });

  // Create patient
  const patient = await patientService.createPatient(patientData, providerId);

  // Log PHI access
  logger.audit('PATIENT_CREATED', providerId, patient.id, {
    mrn: patient.mrn,
    action: 'CREATE',
  });

  // Track metrics
  metrics.success('CreatePatient');
  metrics.duration('CreatePatientDuration', startTime);
  metrics.phiAccess(providerId, 'Patient', 'Create');

  return response.success({
    patient,
  }, 201);
};

export const handler = errorHandler(createPatientHandler);