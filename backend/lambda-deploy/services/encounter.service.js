"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncounterService = void 0;
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const uuid_1 = require("uuid");
const encounter_1 = require("../types/encounter");
const errors_1 = require("../errors");
const logger_1 = require("../utils/logger");
const metrics_1 = require("../utils/metrics");
class EncounterService {
    dynamodb;
    tableName;
    constructor(dynamodb, tableName) {
        this.dynamodb = dynamodb;
        this.tableName = tableName;
    }
    /**
     * Create a new encounter
     */
    async createEncounter(input, providerId) {
        const encounterId = (0, uuid_1.v4)();
        const timestamp = new Date().toISOString();
        const scheduledAt = input.scheduledAt || timestamp; // Use provided time or current time
        const scheduledDate = scheduledAt.split('T')[0]; // Extract date part
        const encounter = {
            ...input,
            id: encounterId,
            patientId: input.patientId, // We validate this exists in the handler
            providerId,
            scheduledAt,
            status: encounter_1.EncounterStatus.SCHEDULED,
            createdAt: timestamp,
            updatedAt: timestamp,
            createdBy: providerId,
            lastModifiedBy: providerId,
        };
        const entity = {
            ...encounter,
            pk: `ENCOUNTER#${encounterId}`,
            sk: 'METADATA',
            gsi1pk: `PATIENT#${encounter.patientId}`,
            gsi1sk: `ENCOUNTER#${scheduledAt}#${encounterId}`,
            gsi2pk: `PROVIDER#${providerId}#DATE#${scheduledDate}`,
            gsi2sk: `ENCOUNTER#${scheduledAt}#${encounterId}`,
            gsi3pk: `DATE#${scheduledDate}`,
            gsi3sk: `ENCOUNTER#${scheduledAt}#${encounterId}`,
            entityType: 'ENCOUNTER',
        };
        await this.dynamodb.send(new lib_dynamodb_1.PutCommand({
            TableName: this.tableName,
            Item: entity,
            ConditionExpression: 'attribute_not_exists(pk)',
        }));
        logger_1.logger.info('Encounter created', {
            encounterId,
            patientId: input.patientId,
            providerId,
            scheduledAt: scheduledAt,
        });
        metrics_1.metrics.count('EncounterCreated', 1, 'Count', { Type: input.type });
        return encounter;
    }
    /**
     * Get encounter by ID
     */
    async getEncounter(encounterId) {
        const result = await this.dynamodb.send(new lib_dynamodb_1.GetCommand({
            TableName: this.tableName,
            Key: {
                pk: `ENCOUNTER#${encounterId}`,
                sk: 'METADATA',
            },
        }));
        if (!result.Item) {
            return null;
        }
        const entity = result.Item;
        return this.entityToEncounter(entity);
    }
    /**
     * Update encounter information
     */
    async updateEncounter(encounterId, updates, providerId) {
        const timestamp = new Date().toISOString();
        // Build update expression
        const updateExpressions = [];
        const expressionAttributeNames = {};
        const expressionAttributeValues = {};
        Object.entries(updates).forEach(([key, value], index) => {
            if (value !== undefined) {
                updateExpressions.push(`#field${index} = :value${index}`);
                expressionAttributeNames[`#field${index}`] = key;
                expressionAttributeValues[`:value${index}`] = value;
            }
        });
        // Always update timestamps
        updateExpressions.push('#updatedAt = :updatedAt');
        updateExpressions.push('#lastModifiedBy = :lastModifiedBy');
        expressionAttributeNames['#updatedAt'] = 'updatedAt';
        expressionAttributeNames['#lastModifiedBy'] = 'lastModifiedBy';
        expressionAttributeValues[':updatedAt'] = timestamp;
        expressionAttributeValues[':lastModifiedBy'] = providerId;
        const result = await this.dynamodb.send(new lib_dynamodb_1.UpdateCommand({
            TableName: this.tableName,
            Key: {
                pk: `ENCOUNTER#${encounterId}`,
                sk: 'METADATA',
            },
            UpdateExpression: `SET ${updateExpressions.join(', ')}`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
            ConditionExpression: 'attribute_exists(pk)',
            ReturnValues: 'ALL_NEW',
        }));
        if (!result.Attributes) {
            throw new errors_1.NotFoundError('Encounter');
        }
        logger_1.logger.info('Encounter updated', {
            encounterId,
            providerId,
            updatedFields: Object.keys(updates),
        });
        return this.entityToEncounter(result.Attributes);
    }
    /**
     * Update encounter status with workflow validation
     */
    async updateEncounterStatus(encounterId, statusUpdate, providerId) {
        const encounter = await this.getEncounter(encounterId);
        if (!encounter) {
            throw new errors_1.NotFoundError('Encounter');
        }
        // Validate status transition
        this.validateStatusTransition(encounter.status, statusUpdate.status);
        const updates = {
            status: statusUpdate.status,
            notes: statusUpdate.notes,
        };
        // Set timestamps based on status
        const timestamp = new Date().toISOString();
        switch (statusUpdate.status) {
            case encounter_1.EncounterStatus.IN_PROGRESS:
                updates.startedAt = timestamp;
                break;
            case encounter_1.EncounterStatus.COMPLETED:
                updates.completedAt = timestamp;
                break;
        }
        const updatedEncounter = await this.updateEncounter(encounterId, updates, providerId);
        metrics_1.metrics.count('EncounterStatusChanged', 1, 'Count', {
            FromStatus: encounter.status,
            ToStatus: statusUpdate.status,
        });
        return updatedEncounter;
    }
    /**
     * Capture patient consent for encounter
     */
    async captureConsent(encounterId, consent, patientId, providerId) {
        const encounter = await this.getEncounter(encounterId);
        if (!encounter) {
            throw new errors_1.NotFoundError('Encounter');
        }
        const timestamp = new Date().toISOString();
        const newConsent = {
            ...consent,
            grantedAt: timestamp,
            grantedBy: patientId,
        };
        const consents = encounter.consents || [];
        // Remove any existing consent of the same type
        const updatedConsents = consents.filter(c => c.type !== consent.type);
        updatedConsents.push(newConsent);
        const updatedEncounter = await this.updateEncounter(encounterId, { consents: updatedConsents }, providerId);
        logger_1.logger.audit('CONSENT_CAPTURED', providerId, encounterId, {
            consentType: consent.type,
            granted: consent.granted,
            patientId,
        });
        metrics_1.metrics.count('ConsentCaptured', 1, 'Count', {
            Type: consent.type,
            Granted: consent.granted.toString(),
        });
        return updatedEncounter;
    }
    /**
     * Get daily encounter list for a provider
     */
    async getDailyEncounters(providerId, date, status, limit = 50, nextToken) {
        const params = {
            TableName: this.tableName,
            IndexName: 'gsi2',
            KeyConditionExpression: 'gsi2pk = :pk',
            ExpressionAttributeValues: {
                ':pk': `PROVIDER#${providerId}#DATE#${date}`,
            },
            Limit: limit,
        };
        if (status) {
            params.FilterExpression = '#status = :status';
            params.ExpressionAttributeNames = { '#status': 'status' };
            params.ExpressionAttributeValues[':status'] = status;
        }
        if (nextToken) {
            params.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
        }
        const result = await this.dynamodb.send(new lib_dynamodb_1.QueryCommand(params));
        const encounters = (result.Items || [])
            .map((item) => this.entityToEncounter(item));
        const responseNextToken = result.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
            : undefined;
        return { encounters, nextToken: responseNextToken };
    }
    /**
     * Get all encounters for a date (all providers)
     */
    async getEncountersByDate(date, limit = 100, nextToken) {
        const params = {
            TableName: this.tableName,
            IndexName: 'gsi3',
            KeyConditionExpression: 'gsi3pk = :pk',
            ExpressionAttributeValues: {
                ':pk': `DATE#${date}`,
            },
            Limit: limit,
        };
        if (nextToken) {
            params.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
        }
        const result = await this.dynamodb.send(new lib_dynamodb_1.QueryCommand(params));
        const encounters = (result.Items || [])
            .map((item) => this.entityToEncounter(item));
        const responseNextToken = result.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
            : undefined;
        return { encounters, nextToken: responseNextToken };
    }
    /**
     * Get patient encounters
     */
    async getPatientEncounters(patientId, limit = 20, nextToken) {
        const params = {
            TableName: this.tableName,
            IndexName: 'gsi1',
            KeyConditionExpression: 'gsi1pk = :pk',
            ExpressionAttributeValues: {
                ':pk': `PATIENT#${patientId}`,
            },
            Limit: limit,
            ScanIndexForward: false, // Most recent first
        };
        if (nextToken) {
            params.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
        }
        const result = await this.dynamodb.send(new lib_dynamodb_1.QueryCommand(params));
        const encounters = (result.Items || [])
            .filter((item) => item.entityType === 'ENCOUNTER')
            .map((item) => this.entityToEncounter(item));
        const responseNextToken = result.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
            : undefined;
        return { encounters, nextToken: responseNextToken };
    }
    /**
     * Add recording to encounter
     */
    async addRecording(encounterId, recording, providerId) {
        const encounter = await this.getEncounter(encounterId);
        if (!encounter) {
            throw new errors_1.NotFoundError('Encounter');
        }
        const recordingWithId = {
            ...recording,
            id: (0, uuid_1.v4)(),
        };
        const recordings = encounter.recordings || [];
        recordings.push(recordingWithId);
        return await this.updateEncounter(encounterId, { recordings }, providerId);
    }
    /**
     * Validate status transitions
     */
    validateStatusTransition(currentStatus, newStatus) {
        const validTransitions = {
            [encounter_1.EncounterStatus.SCHEDULED]: [
                encounter_1.EncounterStatus.CHECKED_IN,
                encounter_1.EncounterStatus.CANCELLED,
                encounter_1.EncounterStatus.NO_SHOW,
            ],
            [encounter_1.EncounterStatus.CHECKED_IN]: [
                encounter_1.EncounterStatus.IN_PROGRESS,
                encounter_1.EncounterStatus.CANCELLED,
                encounter_1.EncounterStatus.NO_SHOW,
            ],
            [encounter_1.EncounterStatus.IN_PROGRESS]: [
                encounter_1.EncounterStatus.COMPLETED,
                encounter_1.EncounterStatus.CANCELLED,
            ],
            [encounter_1.EncounterStatus.COMPLETED]: [], // Terminal state
            [encounter_1.EncounterStatus.CANCELLED]: [], // Terminal state
            [encounter_1.EncounterStatus.NO_SHOW]: [], // Terminal state
        };
        const allowedTransitions = validTransitions[currentStatus];
        if (!allowedTransitions.includes(newStatus)) {
            throw new errors_1.BusinessLogicError(`Invalid status transition from ${currentStatus} to ${newStatus}`, 400);
        }
    }
    /**
     * Convert entity to encounter model
     */
    entityToEncounter(entity) {
        const { pk, sk, gsi1pk, gsi1sk, gsi2pk, gsi2sk, gsi3pk, gsi3sk, entityType, ...encounter } = entity;
        return encounter;
    }
}
exports.EncounterService = EncounterService;
//# sourceMappingURL=encounter.service.js.map