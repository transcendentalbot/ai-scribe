"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const response_1 = require("../../utils/response");
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
const handler = async (event) => {
    try {
        const encounterId = event.pathParameters?.encounterId;
        const body = JSON.parse(event.body || '{}');
        const { timestamp, speaker } = body;
        if (!encounterId || !timestamp || !speaker) {
            return response_1.response.error('Encounter ID, timestamp, and speaker are required', 400);
        }
        console.log(`[update-speaker] Updating speaker for encounter: ${encounterId}, timestamp: ${timestamp}, speaker: ${speaker}`);
        await docClient.send(new lib_dynamodb_1.UpdateCommand({
            TableName: process.env.TABLE_NAME,
            Key: {
                pk: `ENCOUNTER#${encounterId}`,
                sk: `TRANSCRIPT#${timestamp}`,
            },
            UpdateExpression: 'SET speaker = :speaker',
            ExpressionAttributeValues: {
                ':speaker': speaker,
            },
        }));
        console.log(`[update-speaker] Successfully updated speaker`);
        return response_1.response.success({
            message: 'Speaker updated successfully',
            encounterId,
            timestamp,
            speaker,
        });
    }
    catch (error) {
        console.error('[update-speaker] Error:', error);
        return response_1.response.error('Failed to update speaker', 500);
    }
};
exports.handler = handler;
//# sourceMappingURL=update-speaker.js.map