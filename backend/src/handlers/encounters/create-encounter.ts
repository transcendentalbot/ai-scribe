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
  const requestId = context.awsRequestId;
  
  logger.info('[CREATE_ENCOUNTER] Handler started', {
    requestId,
    timestamp: new Date().toISOString(),
    method: event.httpMethod,
    path: event.path,
    userAgent: event.headers['User-Agent'],
    origin: event.headers.Origin
  });
  
  // Get provider ID from token
  logger.info('[CREATE_ENCOUNTER] Extracting token', { requestId });
  const token = getAuthToken(event);
  
  logger.info('[CREATE_ENCOUNTER] Decoding token', { requestId, hasToken: !!token });
  // Decode the access token to get the user ID
  const decodedToken = jwt.decode(token) as any;
  const providerId = decodedToken?.sub || decodedToken?.username;
  
  logger.info('[CREATE_ENCOUNTER] Provider extracted', { requestId, providerId: providerId ? 'PRESENT' : 'MISSING' });
  
  if (!providerId) {
    logger.error('[CREATE_ENCOUNTER] No provider ID found', { requestId, decodedToken });
    throw new AuthorizationError('Provider ID not found');
  }

  // Validate request body
  logger.info('[CREATE_ENCOUNTER] Validating request body', { requestId, bodyLength: event.body?.length || 0 });
  const encounterData = validateBody(event, CreateEncounterSchema);
  logger.info('[CREATE_ENCOUNTER] Request body validated successfully', { 
    requestId, 
    type: encounterData.type,
    hasPatientId: !!encounterData.patientId,
    hasPatientName: !!encounterData.patientName,
    hasPatientMRN: !!encounterData.patientMRN
  });

  // Check consent
  logger.info('[CREATE_ENCOUNTER] Checking consent', { requestId, consentObtained: encounterData.consentObtained });
  if (!encounterData.consentObtained) {
    logger.error('[CREATE_ENCOUNTER] Consent not obtained', { requestId });
    throw new ValidationError('Consent must be obtained before creating an encounter');
  }

  logger.info('[CREATE_ENCOUNTER] Starting encounter creation process', {
    requestId,
    providerId: providerId ? 'PRESENT' : 'MISSING',
    type: encounterData.type,
    hasPatientId: !!encounterData.patientId,
    hasPatientInfo: !!(encounterData.patientName && encounterData.patientMRN)
  });

  let patientId = encounterData.patientId;

  // If no patient ID, check if we need to create or find patient
  if (!patientId && encounterData.patientName && encounterData.patientMRN) {
    logger.info('[CREATE_ENCOUNTER] No patient ID provided, checking for existing patient', { 
      requestId, 
      patientMRN: encounterData.patientMRN 
    });
    
    // Check if patient with MRN exists
    const existingPatient = await patientService.getPatientByMrn(encounterData.patientMRN);
    logger.info('[CREATE_ENCOUNTER] Patient lookup complete', { 
      requestId, 
      found: !!existingPatient,
      patientId: existingPatient?.id 
    });
    
    if (existingPatient) {
      patientId = existingPatient.id;
      logger.info('[CREATE_ENCOUNTER] Using existing patient', { requestId, patientId });
    } else {
      logger.info('[CREATE_ENCOUNTER] Creating new patient', { requestId });
      // Create new patient with minimal info
      const newPatient = await patientService.createPatient({
        firstName: encounterData.patientName.split(' ')[0] || encounterData.patientName,
        lastName: encounterData.patientName.split(' ').slice(1).join(' ') || '',
        mrn: encounterData.patientMRN,
        dateOfBirth: encounterData.patientBirthdate || '1900-01-01', // Use provided birthdate or placeholder
        gender: 'Unknown',
        encryptedName: encryptPHI(encounterData.patientName),
        encryptedMrn: encryptPHI(encounterData.patientMRN),
      } as any, providerId);
      patientId = newPatient.id;
      logger.info('[CREATE_ENCOUNTER] New patient created', { requestId, patientId });
    }
  }

  if (!patientId) {
    logger.error('[CREATE_ENCOUNTER] No patient ID resolved', { requestId });
    throw new ValidationError('Either patient ID or patient name/MRN must be provided');
  }

  logger.info('[CREATE_ENCOUNTER] Creating encounter in database', { requestId, patientId });
  // Create encounter with the resolved patient ID
  const encounter = await encounterService.createEncounter({
    type: encounterData.type,
    consentObtained: encounterData.consentObtained || false,
    patientId,
    scheduledAt: new Date().toISOString(), // Set to now for immediate encounters
  }, providerId);
  
  logger.info('[CREATE_ENCOUNTER] Encounter created successfully', { 
    requestId, 
    encounterId: encounter.id,
    patientId: encounter.patientId 
  });

  // Log PHI access
  logger.info('[CREATE_ENCOUNTER] Logging PHI access audit', { requestId });
  logger.audit('ENCOUNTER_CREATED', providerId, encounter.id, {
    patientId: encounter.patientId,
    action: 'CREATE',
  });

  // Track metrics
  logger.info('[CREATE_ENCOUNTER] Recording metrics', { requestId });
  metrics.success('CreateEncounter');
  metrics.duration('CreateEncounterDuration', startTime);
  metrics.count('EncounterType', 1, 'Count', { Type: encounter.type });

  logger.info('[CREATE_ENCOUNTER] Preparing response', { 
    requestId, 
    encounterId: encounter.id,
    duration: Date.now() - startTime 
  });

  const responseData = {
    encounter,
  };
  
  logger.info('[CREATE_ENCOUNTER] Sending response', { 
    requestId, 
    statusCode: 201,
    responseSize: JSON.stringify(responseData).length,
    totalDuration: Date.now() - startTime 
  });

  return response.success(responseData, 201);
};

export const handler = errorHandler(createEncounterHandler);