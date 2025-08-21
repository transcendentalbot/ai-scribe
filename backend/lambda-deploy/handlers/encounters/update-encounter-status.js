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
const updateEncounterStatusHandler = async (event, context) => {
    const startTime = Date.now();
    // Get provider ID from token
    const providerId = (0, jwt_1.getProviderIdFromToken)(event);
    // Validate path parameters
    const { encounterId } = (0, request_validator_1.validatePathParams)(event, PathParamsSchema);
    // Validate request body
    const statusUpdate = (0, request_validator_1.validateBody)(event, encounter_1.UpdateEncounterStatusSchema);
    logger_1.logger.info('Updating encounter status', {
        providerId,
        encounterId,
        newStatus: statusUpdate.status,
    });
    // Get current encounter to check authorization
    const currentEncounter = await encounterService.getEncounter(encounterId);
    if (!currentEncounter) {
        throw new errors_1.NotFoundError('Encounter');
    }
    // Only the assigned provider can update the encounter
    if (currentEncounter.providerId !== providerId) {
        throw new errors_1.AuthorizationError('You can only update your own encounters');
    }
    // Update status
    const encounter = await encounterService.updateEncounterStatus(encounterId, statusUpdate, providerId);
    // Log PHI access
    logger_1.logger.audit('ENCOUNTER_STATUS_UPDATED', providerId, encounter.id, {
        patientId: encounter.patientId,
        fromStatus: currentEncounter.status,
        toStatus: statusUpdate.status,
        action: 'UPDATE_STATUS',
    });
    // Track metrics
    metrics_1.metrics.success('UpdateEncounterStatus');
    metrics_1.metrics.duration('UpdateEncounterStatusDuration', startTime);
    return response_1.response.success({
        encounter,
    });
};
exports.handler = (0, error_handler_1.errorHandler)(updateEncounterStatusHandler);
//# sourceMappingURL=update-encounter-status.js.map