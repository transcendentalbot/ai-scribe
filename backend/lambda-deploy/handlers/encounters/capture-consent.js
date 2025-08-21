"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const zod_1 = require("zod");
const encounter_1 = require("../../types/encounter");
const encounter_service_1 = require("../../services/encounter.service");
const error_handler_1 = require("../../middleware/error-handler");
const request_validator_1 = require("../../middleware/request-validator");
const response_1 = require("../../utils/response");
const logger_1 = require("../../utils/logger");
const metrics_1 = require("../../utils/metrics");
const jwt_1 = require("../../utils/jwt");
const errors_1 = require("../../errors");
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
const dynamodb = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
const encounterService = new encounter_service_1.EncounterService(dynamodb, process.env.TABLE_NAME);
const PathParamsSchema = zod_1.z.object({
    encounterId: zod_1.z.string().uuid(),
});
const captureConsentHandler = async (event, context) => {
    const startTime = Date.now();
    // Get provider ID from token
    const providerId = (0, jwt_1.getProviderIdFromToken)(event);
    // Validate path parameters
    const { encounterId } = (0, request_validator_1.validatePathParams)(event, PathParamsSchema);
    // Validate request body
    const consentData = (0, request_validator_1.validateBody)(event, encounter_1.CaptureConsentSchema);
    logger_1.logger.info('Capturing consent', {
        providerId,
        encounterId,
        consentType: consentData.type,
        granted: consentData.granted,
    });
    // Get encounter to verify it exists and get patient ID
    const currentEncounter = await encounterService.getEncounter(encounterId);
    if (!currentEncounter) {
        throw new errors_1.NotFoundError('Encounter');
    }
    // Only the assigned provider can capture consent
    if (currentEncounter.providerId !== providerId) {
        throw new errors_1.AuthorizationError('You can only capture consent for your own encounters');
    }
    // Capture consent
    const encounter = await encounterService.captureConsent(encounterId, consentData, currentEncounter.patientId, // Patient is granting consent
    providerId);
    // Track metrics
    metrics_1.metrics.success('CaptureConsent');
    metrics_1.metrics.duration('CaptureConsentDuration', startTime);
    metrics_1.metrics.count('ConsentType', 1, 'Count', {
        Type: consentData.type,
        Granted: consentData.granted.toString(),
    });
    return response_1.response.success({
        encounter,
        message: `Consent for ${consentData.type} has been ${consentData.granted ? 'granted' : 'denied'}`,
    });
};
exports.handler = (0, error_handler_1.errorHandler)(captureConsentHandler);
//# sourceMappingURL=capture-consent.js.map