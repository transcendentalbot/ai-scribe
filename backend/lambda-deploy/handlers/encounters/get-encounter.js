"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const encounter_service_1 = require("../../services/encounter.service");
const patient_service_1 = require("../../services/patient.service");
const error_handler_1 = require("../../middleware/error-handler");
const response_1 = require("../../utils/response");
const logger_1 = require("../../utils/logger");
const metrics_1 = require("../../utils/metrics");
const errors_1 = require("../../errors");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
const dynamodb = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
const encounterService = new encounter_service_1.EncounterService(dynamodb, process.env.TABLE_NAME);
const patientService = new patient_service_1.PatientService(dynamodb, process.env.TABLE_NAME);
const getEncounterHandler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    const startTime = Date.now();
    const encounterId = event.pathParameters?.encounterId;
    if (!encounterId) {
        return response_1.response.error('Encounter ID is required', 400);
    }
    // Get provider ID from token
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new errors_1.AuthorizationError('No authorization token provided');
    }
    const token = authHeader.split(' ')[1];
    const decodedToken = jsonwebtoken_1.default.decode(token);
    const providerId = decodedToken?.sub || decodedToken?.username;
    if (!providerId) {
        throw new errors_1.AuthorizationError('Invalid token: no provider ID');
    }
    logger_1.logger.info('Getting encounter', { encounterId, providerId });
    // Get encounter
    const encounter = await encounterService.getEncounter(encounterId);
    if (!encounter) {
        throw new errors_1.NotFoundError('Encounter not found');
    }
    // Check if provider has access to this encounter
    if (encounter.providerId !== providerId) {
        logger_1.logger.warn('Access denied to encounter', {
            encounterId,
            requestingProviderId: providerId,
            encounterProviderId: encounter.providerId
        });
        throw new errors_1.AuthorizationError('You do not have access to this encounter');
    }
    // Get patient details
    const patient = await patientService.getPatient(encounter.patientId);
    // Add patient to encounter response
    const encounterWithPatient = {
        ...encounter,
        patient,
    };
    // Track metrics
    metrics_1.metrics.success('GetEncounter');
    metrics_1.metrics.duration('GetEncounterDuration', startTime);
    return response_1.response.success({
        encounter: encounterWithPatient,
    });
};
exports.handler = (0, error_handler_1.errorHandler)(getEncounterHandler);
//# sourceMappingURL=get-encounter.js.map