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
import { AuthorizationError, NotFoundError, ValidationError } from '../../errors';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const dynamoClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const encounterService = new EncounterService(dynamodb, process.env.TABLE_NAME!);
const patientService = new PatientService(dynamodb, process.env.TABLE_NAME!);

// Simple encryption for PHI (in production, use AWS KMS)
const encryptPHI = (text: string): string => {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

const createEncounterHandler = async (event: APIGatewayProxyEvent, context: Context) => {
  const startTime = Date.now();
  
  // Get provider ID from token
  const token = getAuthToken(event);
  // Decode the access token to get the user ID
  const decodedToken = jwt.decode(token) as any;
  const providerId = decodedToken?.sub || decodedToken?.username;
  
  if (!providerId) {
    throw new AuthorizationError('Provider ID not found');
  }

  // Validate request body
  const encounterData = validateBody(event, CreateEncounterSchema);

  // Check consent
  if (!encounterData.consentObtained) {
    throw new ValidationError('Consent must be obtained before creating an encounter');
  }

  logger.info('Creating encounter', {
    providerId,
    type: encounterData.type,
    hasPatientId: !!encounterData.patientId,
    hasPatientInfo: !!(encounterData.patientName && encounterData.patientMRN)
  });

  let patientId = encounterData.patientId;

  // If no patient ID, check if we need to create or find patient
  if (!patientId && encounterData.patientName && encounterData.patientMRN) {
    // Check if patient with MRN exists
    const existingPatient = await patientService.getPatientByMrn(encounterData.patientMRN);
    
    if (existingPatient) {
      patientId = existingPatient.id;
    } else {
      // Create new patient with minimal info
      const newPatient = await patientService.createPatient({
        firstName: encounterData.patientName.split(' ')[0] || encounterData.patientName,
        lastName: encounterData.patientName.split(' ').slice(1).join(' ') || '',
        mrn: encounterData.patientMRN,
        dateOfBirth: '1900-01-01', // Placeholder for MVP
        gender: 'Unknown',
        encryptedName: encryptPHI(encounterData.patientName),
        encryptedMrn: encryptPHI(encounterData.patientMRN),
      } as any, providerId);
      patientId = newPatient.id;
    }
  }

  if (!patientId) {
    throw new ValidationError('Either patient ID or patient name/MRN must be provided');
  }

  // Create encounter with the resolved patient ID
  const encounter = await encounterService.createEncounter({
    type: encounterData.type,
    consentObtained: encounterData.consentObtained || false,
    patientId,
    scheduledAt: new Date().toISOString(), // Set to now for immediate encounters
  }, providerId);

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