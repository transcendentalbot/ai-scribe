"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
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
const errors_1 = require("../../errors");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
const dynamodb = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
const patientService = new patient_service_1.PatientService(dynamodb, process.env.TABLE_NAME);
const searchPatientsHandler = async (event, context) => {
    const startTime = Date.now();
    // Get provider ID from token
    const token = (0, request_validator_1.getAuthToken)(event);
    // Decode the access token to get the user ID
    const decodedToken = jsonwebtoken_1.default.decode(token);
    const providerId = decodedToken?.sub || decodedToken?.username;
    if (!providerId) {
        throw new errors_1.AuthorizationError('Provider ID not found');
    }
    // Validate query parameters
    const { query, limit, nextToken } = (0, request_validator_1.validateQueryParams)(event, patient_1.PatientSearchSchema);
    logger_1.logger.info('Searching patients', {
        providerId,
        query,
        limit,
    });
    // Search patients
    const result = await patientService.searchPatients(query, Number(limit), nextToken);
    // Log PHI access
    logger_1.logger.audit('PATIENT_SEARCH', providerId, 'SEARCH', {
        query,
        resultCount: result.patients.length,
        action: 'SEARCH',
    });
    // Track metrics
    metrics_1.metrics.success('SearchPatients');
    metrics_1.metrics.duration('SearchPatientsDuration', startTime);
    metrics_1.metrics.gauge('SearchResultCount', result.patients.length);
    return response_1.response.success({
        patients: result.patients,
        nextToken: result.nextToken,
    });
};
exports.handler = (0, error_handler_1.errorHandler)(searchPatientsHandler);
//# sourceMappingURL=search-patients.js.map