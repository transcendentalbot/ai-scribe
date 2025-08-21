"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const zod_1 = require("zod");
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
const PathParamsSchema = zod_1.z.object({
    patientId: zod_1.z.string().uuid(),
});
const getPatientHandler = async (event, context) => {
    const startTime = Date.now();
    // Get provider ID from token
    const token = (0, request_validator_1.getAuthToken)(event);
    const user = await cognito_1.cognitoService.getUser(token);
    const providerId = user.UserAttributes?.find(attr => attr.Name === 'custom:user_id')?.Value;
    if (!providerId) {
        throw new errors_1.AuthorizationError('Provider ID not found');
    }
    // Validate path parameters
    const { patientId } = (0, request_validator_1.validatePathParams)(event, PathParamsSchema);
    logger_1.logger.info('Getting patient', {
        providerId,
        patientId,
    });
    // Get patient
    const patient = await patientService.getPatient(patientId);
    if (!patient) {
        throw new errors_1.NotFoundError('Patient');
    }
    // Log PHI access
    logger_1.logger.audit('PATIENT_ACCESSED', providerId, patient.id, {
        action: 'READ',
    });
    // Track metrics
    metrics_1.metrics.success('GetPatient');
    metrics_1.metrics.duration('GetPatientDuration', startTime);
    metrics_1.metrics.phiAccess(providerId, 'Patient', 'Read');
    return response_1.response.success({
        patient,
    });
};
exports.handler = (0, error_handler_1.errorHandler)(getPatientHandler);
//# sourceMappingURL=get-patient.js.map