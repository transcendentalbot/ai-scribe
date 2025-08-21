"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const patient_1 = require("../../types/patient");
const patient_service_1 = require("../../services/patient.service");
const error_handler_1 = require("../../middleware/error-handler");
const request_validator_1 = require("../../middleware/request-validator");
const response_1 = require("../../utils/response");
const logger_1 = require("../../utils/logger");
const metrics_1 = require("../../utils/metrics");
const cognito_1 = require("../../utils/cognito");
const errors_1 = require("../../errors");
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
const dynamodb = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
const patientService = new patient_service_1.PatientService(dynamodb, process.env.TABLE_NAME);
const createPatientHandler = async (event, context) => {
    const startTime = Date.now();
    // Get provider ID from token
    const token = (0, request_validator_1.getAuthToken)(event);
    const user = await cognito_1.cognitoService.getUser(token);
    const providerId = user.UserAttributes?.find(attr => attr.Name === 'custom:user_id')?.Value;
    if (!providerId) {
        throw new errors_1.AuthorizationError('Provider ID not found');
    }
    // Validate request body
    const patientData = (0, request_validator_1.validateBody)(event, patient_1.CreatePatientSchema);
    logger_1.logger.info('Creating patient', {
        providerId,
        mrn: patientData.mrn,
    });
    // Create patient
    const patient = await patientService.createPatient(patientData, providerId);
    // Log PHI access
    logger_1.logger.audit('PATIENT_CREATED', providerId, patient.id, {
        mrn: patient.mrn,
        action: 'CREATE',
    });
    // Track metrics
    metrics_1.metrics.success('CreatePatient');
    metrics_1.metrics.duration('CreatePatientDuration', startTime);
    metrics_1.metrics.phiAccess(providerId, 'Patient', 'Create');
    return response_1.response.success({
        patient,
    }, 201);
};
exports.handler = (0, error_handler_1.errorHandler)(createPatientHandler);
//# sourceMappingURL=create-patient.js.map