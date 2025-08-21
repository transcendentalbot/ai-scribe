"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
const handler = async (event) => {
    const connectionId = event.requestContext.connectionId;
    console.log('WebSocket disconnection:', { connectionId });
    try {
        // Remove connection from DynamoDB
        await docClient.send(new lib_dynamodb_1.DeleteCommand({
            TableName: process.env.CONNECTIONS_TABLE_NAME,
            Key: { connectionId },
        }));
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Disconnected successfully' }),
        };
    }
    catch (error) {
        console.error('Error removing connection:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Failed to disconnect' }),
        };
    }
};
exports.handler = handler;
//# sourceMappingURL=disconnect.js.map