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
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
const dynamodb = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
const encounterService = new encounter_service_1.EncounterService(dynamodb, process.env.TABLE_NAME);
const patientService = new patient_service_1.PatientService(dynamodb, process.env.TABLE_NAME);
const getDailyEncountersHandler = async (event, context) => {
    const startTime = Date.now();
    // Get provider ID from token
    const token = (0, request_validator_1.getAuthToken)(event);
    // Decode the access token to get the user ID
    const decodedToken = jsonwebtoken_1.default.decode(token);
    const currentProviderId = decodedToken?.sub || decodedToken?.username;
    if (!currentProviderId) {
        throw new errors_1.AuthorizationError('Provider ID not found in token');
    }
    // Validate query parameters
    const { date, providerId, status, limit, nextToken } = (0, request_validator_1.validateQueryParams)(event, encounter_1.DailyEncounterListSchema);
    // Use current provider if not specified
    const targetProviderId = providerId || currentProviderId;
    // Use today's date if not specified
    const targetDate = date || new Date().toISOString().split('T')[0];
    logger_1.logger.info('Getting daily encounters', {
        currentProviderId,
        targetProviderId,
        date: targetDate,
        status,
    });
    // Get encounters
    const result = await encounterService.getDailyEncounters(targetProviderId, targetDate, status, Number(limit), nextToken);
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
    logger_1.logger.audit('DAILY_ENCOUNTERS_ACCESSED', currentProviderId, targetDate, {
        providerId: targetProviderId,
        date: targetDate,
        count: result.encounters.length,
        action: 'LIST',
    });
    // Track metrics
    metrics_1.metrics.success('GetDailyEncounters');
    metrics_1.metrics.duration('GetDailyEncountersDuration', startTime);
    metrics_1.metrics.gauge('DailyEncounterCount', result.encounters.length);
    return response_1.response.success({
        date: targetDate,
        providerId: targetProviderId,
        encounters: enrichedEncounters,
        nextToken: result.nextToken,
        summary: {
            total: enrichedEncounters.length,
            byStatus: enrichedEncounters.reduce((acc, e) => {
                acc[e.status] = (acc[e.status] || 0) + 1;
                return acc;
            }, {}),
        },
    });
};
exports.handler = (0, error_handler_1.errorHandler)(getDailyEncountersHandler);
//# sourceMappingURL=get-daily-encounters.js.map