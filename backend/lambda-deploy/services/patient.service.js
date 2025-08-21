"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientService = void 0;
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const uuid_1 = require("uuid");
const errors_1 = require("../errors");
const logger_1 = require("../utils/logger");
class PatientService {
    dynamodb;
    tableName;
    constructor(dynamodb, tableName) {
        this.dynamodb = dynamodb;
        this.tableName = tableName;
    }
    /**
     * Create a new patient record
     */
    async createPatient(input, providerId) {
        const patientId = (0, uuid_1.v4)();
        const timestamp = new Date().toISOString();
        // Check if MRN already exists
        const existingMrn = await this.getPatientByMrn(input.mrn);
        if (existingMrn) {
            throw new errors_1.ConflictError('Patient with this MRN already exists');
        }
        const patient = {
            ...input,
            id: patientId,
            createdAt: timestamp,
            updatedAt: timestamp,
            createdBy: providerId,
            lastModifiedBy: providerId,
        };
        const entity = {
            ...patient,
            pk: `PATIENT#${patientId}`,
            sk: 'PROFILE',
            gsi1pk: `MRN#${input.mrn}`,
            gsi1sk: `PATIENT#${patientId}`,
            gsi2pk: `PROVIDER#${providerId}`,
            gsi2sk: `PATIENT#${patientId}#${timestamp}`,
            entityType: 'PATIENT',
        };
        await this.dynamodb.send(new lib_dynamodb_1.PutCommand({
            TableName: this.tableName,
            Item: entity,
            ConditionExpression: 'attribute_not_exists(pk)',
        }));
        logger_1.logger.info('Patient created', {
            patientId,
            mrn: input.mrn,
            providerId,
        });
        return patient;
    }
    /**
     * Get patient by ID
     */
    async getPatient(patientId) {
        const result = await this.dynamodb.send(new lib_dynamodb_1.GetCommand({
            TableName: this.tableName,
            Key: {
                pk: `PATIENT#${patientId}`,
                sk: 'PROFILE',
            },
        }));
        if (!result.Item) {
            return null;
        }
        const entity = result.Item;
        return this.entityToPatient(entity);
    }
    /**
     * Get patient by MRN
     */
    async getPatientByMrn(mrn) {
        const result = await this.dynamodb.send(new lib_dynamodb_1.QueryCommand({
            TableName: this.tableName,
            IndexName: 'gsi1',
            KeyConditionExpression: 'gsi1pk = :pk',
            ExpressionAttributeValues: {
                ':pk': `MRN#${mrn}`,
            },
            Limit: 1,
        }));
        if (!result.Items || result.Items.length === 0) {
            return null;
        }
        const entity = result.Items[0];
        return this.entityToPatient(entity);
    }
    /**
     * Search patients by name, MRN, or date of birth
     */
    async searchPatients(query, limit = 20, nextToken) {
        // This is a simplified search - in production, consider using OpenSearch
        const params = {
            TableName: this.tableName,
            FilterExpression: 'contains(firstName, :query) OR contains(lastName, :query) OR contains(mrn, :query)',
            ExpressionAttributeValues: {
                ':query': query,
            },
            Limit: limit,
        };
        if (nextToken) {
            params.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
        }
        const result = await this.dynamodb.send(new lib_dynamodb_1.QueryCommand(params));
        const patients = (result.Items || [])
            .filter((item) => item.entityType === 'PATIENT')
            .map((item) => this.entityToPatient(item));
        const responseNextToken = result.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
            : undefined;
        return { patients, nextToken: responseNextToken };
    }
    /**
     * Get patients by provider
     */
    async getPatientsByProvider(providerId, limit = 50, nextToken) {
        const params = {
            TableName: this.tableName,
            IndexName: 'gsi2',
            KeyConditionExpression: 'gsi2pk = :pk',
            ExpressionAttributeValues: {
                ':pk': `PROVIDER#${providerId}`,
            },
            Limit: limit,
            ScanIndexForward: false, // Most recent first
        };
        if (nextToken) {
            params.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
        }
        const result = await this.dynamodb.send(new lib_dynamodb_1.QueryCommand(params));
        const patients = (result.Items || [])
            .filter((item) => item.entityType === 'PATIENT')
            .map((item) => this.entityToPatient(item));
        const responseNextToken = result.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
            : undefined;
        return { patients, nextToken: responseNextToken };
    }
    /**
     * Update patient information
     */
    async updatePatient(patientId, updates, providerId) {
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
                pk: `PATIENT#${patientId}`,
                sk: 'PROFILE',
            },
            UpdateExpression: `SET ${updateExpressions.join(', ')}`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
            ConditionExpression: 'attribute_exists(pk)',
            ReturnValues: 'ALL_NEW',
        }));
        if (!result.Attributes) {
            throw new errors_1.NotFoundError('Patient');
        }
        logger_1.logger.info('Patient updated', {
            patientId,
            providerId,
            updatedFields: Object.keys(updates),
        });
        return this.entityToPatient(result.Attributes);
    }
    /**
     * Get multiple patients by IDs
     */
    async getPatientsByIds(patientIds) {
        if (patientIds.length === 0) {
            return [];
        }
        const keys = patientIds.map(id => ({
            pk: `PATIENT#${id}`,
            sk: 'PROFILE',
        }));
        const result = await this.dynamodb.send(new lib_dynamodb_1.BatchGetCommand({
            RequestItems: {
                [this.tableName]: {
                    Keys: keys,
                },
            },
        }));
        const items = result.Responses?.[this.tableName] || [];
        return items.map((item) => this.entityToPatient(item));
    }
    /**
     * Convert entity to patient model
     */
    entityToPatient(entity) {
        const { pk, sk, gsi1pk, gsi1sk, gsi2pk, gsi2sk, entityType, ...patient } = entity;
        return patient;
    }
}
exports.PatientService = PatientService;
//# sourceMappingURL=patient.service.js.map