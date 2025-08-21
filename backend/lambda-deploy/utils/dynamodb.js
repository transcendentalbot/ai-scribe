"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userService = exports.dynamodb = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client = new client_dynamodb_1.DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1',
});
exports.dynamodb = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME;
exports.userService = {
    async createUser(user) {
        const item = {
            ...user,
            pk: `USER#${user.id}`,
            sk: 'PROFILE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            emailVerified: false,
            mfaEnabled: false,
        };
        await exports.dynamodb.send(new lib_dynamodb_1.PutCommand({
            TableName: TABLE_NAME,
            Item: item,
            ConditionExpression: 'attribute_not_exists(pk)',
        }));
        return item;
    },
    async getUser(userId) {
        const result = await exports.dynamodb.send(new lib_dynamodb_1.GetCommand({
            TableName: TABLE_NAME,
            Key: {
                pk: `USER#${userId}`,
                sk: 'PROFILE',
            },
        }));
        return result.Item;
    },
    async getUserByEmail(email) {
        const result = await exports.dynamodb.send(new lib_dynamodb_1.QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'gsi1',
            KeyConditionExpression: 'gsi1pk = :pk',
            ExpressionAttributeValues: {
                ':pk': `EMAIL#${email.toLowerCase()}`,
            },
            Limit: 1,
        }));
        return result.Items?.[0];
    },
    async updateUser(userId, updates) {
        const updateExpressions = [];
        const expressionAttributeNames = {};
        const expressionAttributeValues = {};
        Object.entries(updates).forEach(([key, value], index) => {
            if (key !== 'pk' && key !== 'sk' && key !== 'id') {
                updateExpressions.push(`#field${index} = :value${index}`);
                expressionAttributeNames[`#field${index}`] = key;
                expressionAttributeValues[`:value${index}`] = value;
            }
        });
        updateExpressions.push('#updatedAt = :updatedAt');
        expressionAttributeNames['#updatedAt'] = 'updatedAt';
        expressionAttributeValues[':updatedAt'] = new Date().toISOString();
        const result = await exports.dynamodb.send(new lib_dynamodb_1.UpdateCommand({
            TableName: TABLE_NAME,
            Key: {
                pk: `USER#${userId}`,
                sk: 'PROFILE',
            },
            UpdateExpression: `SET ${updateExpressions.join(', ')}`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: 'ALL_NEW',
        }));
        return result.Attributes;
    },
    async updateLastLogin(userId) {
        return this.updateUser(userId, {
            lastLoginAt: new Date().toISOString(),
        });
    },
};
//# sourceMappingURL=dynamodb.js.map