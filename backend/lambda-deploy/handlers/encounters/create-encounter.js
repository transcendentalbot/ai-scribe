"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const encounter_1 = require("../../types/encounter");
const encounter_service_1 = require("../../services/encounter.service");
const patient_service_1 = require("../../services/patient.service");
const error_handler_1 = require("../../middleware/error-handler");
const request_validator_1 = require("../../middleware/request-validator");
const response_1 = require("../../utils/response");
const logger_1 = require("../../utils/logger");
const metrics_1 = require("../../utils/metrics");
const errors_1 = require("../../errors");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
const dynamodb = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
const encounterService = new encounter_service_1.EncounterService(dynamodb, process.env.TABLE_NAME);
const patientService = new patient_service_1.PatientService(dynamodb, process.env.TABLE_NAME);
// Simple encryption for PHI (in production, use AWS KMS)
const encryptPHI = (text) => {
    const algorithm = 'aes-256-cbc';
    const key = crypto_1.default.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
    const iv = crypto_1.default.randomBytes(16);
    const cipher = crypto_1.default.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
};
const createEncounterHandler = async (event, context) => {
    const startTime = Date.now();
    const requestId = context.awsRequestId;
    logger_1.logger.info('[CREATE_ENCOUNTER] Handler started', {
        requestId,
        timestamp: new Date().toISOString(),
        method: event.httpMethod,
        path: event.path,
        userAgent: event.headers['User-Agent'],
        origin: event.headers.Origin
    });
    // Get provider ID from token
    logger_1.logger.info('[CREATE_ENCOUNTER] Extracting token', { requestId });
    const token = (0, request_validator_1.getAuthToken)(event);
    logger_1.logger.info('[CREATE_ENCOUNTER] Decoding token', { requestId, hasToken: !!token });
    // Decode the access token to get the user ID
    const decodedToken = jsonwebtoken_1.default.decode(token);
    const providerId = decodedToken?.sub || decodedToken?.username;
    logger_1.logger.info('[CREATE_ENCOUNTER] Provider extracted', { requestId, providerId: providerId ? 'PRESENT' : 'MISSING' });
    if (!providerId) {
        logger_1.logger.error('[CREATE_ENCOUNTER] No provider ID found', { requestId, decodedToken });
        throw new errors_1.AuthorizationError('Provider ID not found');
    }
    // Validate request body
    logger_1.logger.info('[CREATE_ENCOUNTER] Validating request body', { requestId, bodyLength: event.body?.length || 0 });
    const encounterData = (0, request_validator_1.validateBody)(event, encounter_1.CreateEncounterSchema);
    logger_1.logger.info('[CREATE_ENCOUNTER] Request body validated successfully', {
        requestId,
        type: encounterData.type,
        hasPatientId: !!encounterData.patientId,
        hasPatientName: !!encounterData.patientName,
        hasPatientMRN: !!encounterData.patientMRN
    });
    // Check consent
    logger_1.logger.info('[CREATE_ENCOUNTER] Checking consent', { requestId, consentObtained: encounterData.consentObtained });
    if (!encounterData.consentObtained) {
        logger_1.logger.error('[CREATE_ENCOUNTER] Consent not obtained', { requestId });
        throw new errors_1.ValidationError('Consent must be obtained before creating an encounter');
    }
    logger_1.logger.info('[CREATE_ENCOUNTER] Starting encounter creation process', {
        requestId,
        providerId: providerId ? 'PRESENT' : 'MISSING',
        type: encounterData.type,
        hasPatientId: !!encounterData.patientId,
        hasPatientInfo: !!(encounterData.patientName && encounterData.patientMRN)
    });
    let patientId = encounterData.patientId;
    // If no patient ID, check if we need to create or find patient
    if (!patientId && encounterData.patientName && encounterData.patientMRN) {
        logger_1.logger.info('[CREATE_ENCOUNTER] No patient ID provided, checking for existing patient', {
            requestId,
            patientMRN: encounterData.patientMRN
        });
        // Check if patient with MRN exists
        const existingPatient = await patientService.getPatientByMrn(encounterData.patientMRN);
        logger_1.logger.info('[CREATE_ENCOUNTER] Patient lookup complete', {
            requestId,
            found: !!existingPatient,
            patientId: existingPatient?.id
        });
        if (existingPatient) {
            patientId = existingPatient.id;
            logger_1.logger.info('[CREATE_ENCOUNTER] Using existing patient', { requestId, patientId });
        }
        else {
            logger_1.logger.info('[CREATE_ENCOUNTER] Creating new patient', { requestId });
            // Create new patient with minimal info
            const newPatient = await patientService.createPatient({
                firstName: encounterData.patientName.split(' ')[0] || encounterData.patientName,
                lastName: encounterData.patientName.split(' ').slice(1).join(' ') || '',
                mrn: encounterData.patientMRN,
                dateOfBirth: encounterData.patientBirthdate || '1900-01-01', // Use provided birthdate or placeholder
                gender: 'Unknown',
                encryptedName: encryptPHI(encounterData.patientName),
                encryptedMrn: encryptPHI(encounterData.patientMRN),
            }, providerId);
            patientId = newPatient.id;
            logger_1.logger.info('[CREATE_ENCOUNTER] New patient created', { requestId, patientId });
        }
    }
    if (!patientId) {
        logger_1.logger.error('[CREATE_ENCOUNTER] No patient ID resolved', { requestId });
        throw new errors_1.ValidationError('Either patient ID or patient name/MRN must be provided');
    }
    logger_1.logger.info('[CREATE_ENCOUNTER] Creating encounter in database', { requestId, patientId });
    // Create encounter with the resolved patient ID
    const encounter = await encounterService.createEncounter({
        type: encounterData.type,
        consentObtained: encounterData.consentObtained || false,
        patientId,
        scheduledAt: new Date().toISOString(), // Set to now for immediate encounters
    }, providerId);
    logger_1.logger.info('[CREATE_ENCOUNTER] Encounter created successfully', {
        requestId,
        encounterId: encounter.id,
        patientId: encounter.patientId
    });
    // Log PHI access
    logger_1.logger.info('[CREATE_ENCOUNTER] Logging PHI access audit', { requestId });
    logger_1.logger.audit('ENCOUNTER_CREATED', providerId, encounter.id, {
        patientId: encounter.patientId,
        action: 'CREATE',
    });
    // Track metrics
    logger_1.logger.info('[CREATE_ENCOUNTER] Recording metrics', { requestId });
    metrics_1.metrics.success('CreateEncounter');
    metrics_1.metrics.duration('CreateEncounterDuration', startTime);
    metrics_1.metrics.count('EncounterType', 1, 'Count', { Type: encounter.type });
    logger_1.logger.info('[CREATE_ENCOUNTER] Preparing response', {
        requestId,
        encounterId: encounter.id,
        duration: Date.now() - startTime
    });
    const responseData = {
        encounter,
    };
    logger_1.logger.info('[CREATE_ENCOUNTER] Sending response', {
        requestId,
        statusCode: 201,
        responseSize: JSON.stringify(responseData).length,
        totalDuration: Date.now() - startTime
    });
    return response_1.response.success(responseData, 201);
};
exports.handler = (0, error_handler_1.errorHandler)(createEncounterHandler);
//# sourceMappingURL=create-encounter.js.map