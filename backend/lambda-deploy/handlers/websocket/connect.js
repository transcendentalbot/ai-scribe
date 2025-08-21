"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
const handler = async (event) => {
    const connectionId = event.requestContext.connectionId;
    const timestamp = new Date().toISOString();
    console.log('WebSocket connection request:', {
        connectionId,
        sourceIp: event.requestContext.identity.sourceIp,
        userAgent: event.requestContext.identity.userAgent,
    });
    try {
        // Store connection in DynamoDB
        await docClient.send(new lib_dynamodb_1.PutCommand({
            TableName: process.env.CONNECTIONS_TABLE_NAME,
            Item: {
                connectionId,
                connectedAt: timestamp,
                ttl: Math.floor(Date.now() / 1000) + 3600, // 1 hour TTL
                status: 'connected',
                sourceIp: event.requestContext.identity.sourceIp,
                userAgent: event.requestContext.identity.userAgent,
            },
        }));
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Connected successfully' }),
        };
    }
    catch (error) {
        console.error('Error storing connection:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Failed to connect' }),
        };
    }
};
exports.handler = handler;
//# sourceMappingURL=connect.js.map