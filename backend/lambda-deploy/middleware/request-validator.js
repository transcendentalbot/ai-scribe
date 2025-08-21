"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBody = validateBody;
exports.validateQueryParams = validateQueryParams;
exports.validatePathParams = validatePathParams;
exports.getAuthToken = getAuthToken;
exports.validateContentType = validateContentType;
const errors_1 = require("../errors");
/**
 * Validates request body against a Zod schema
 */
function validateBody(event, schema) {
    try {
        const body = JSON.parse(event.body || '{}');
        return schema.parse(body);
    }
    catch (error) {
        if (error.name === 'SyntaxError') {
            throw new errors_1.ValidationError('Invalid JSON in request body');
        }
        throw error; // Re-throw for error handler to catch Zod errors
    }
}
/**
 * Validates query string parameters against a Zod schema
 */
function validateQueryParams(event, schema) {
    try {
        return schema.parse(event.queryStringParameters || {});
    }
    catch (error) {
        throw error; // Re-throw for error handler to catch Zod errors
    }
}
/**
 * Validates path parameters against a Zod schema
 */
function validatePathParams(event, schema) {
    try {
        return schema.parse(event.pathParameters || {});
    }
    catch (error) {
        throw error; // Re-throw for error handler to catch Zod errors
    }
}
/**
 * Extracts and validates authorization token from headers
 */
function getAuthToken(event) {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader) {
        throw new errors_1.ValidationError('No authorization token provided');
    }
    if (!authHeader.startsWith('Bearer ')) {
        throw new errors_1.ValidationError('Invalid authorization header format');
    }
    const token = authHeader.substring(7);
    if (!token) {
        throw new errors_1.ValidationError('Empty authorization token');
    }
    return token;
}
/**
 * Validates content type header
 */
function validateContentType(event, expectedType) {
    const contentType = event.headers['Content-Type'] || event.headers['content-type'];
    if (!contentType || !contentType.includes(expectedType)) {
        throw new errors_1.ValidationError(`Content-Type must be ${expectedType}`);
    }
}
//# sourceMappingURL=request-validator.js.map