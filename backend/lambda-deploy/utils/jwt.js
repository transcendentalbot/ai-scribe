"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeJWT = decodeJWT;
exports.getUserFromToken = getUserFromToken;
exports.getProviderIdFromToken = getProviderIdFromToken;
const request_validator_1 = require("../middleware/request-validator");
const errors_1 = require("../errors");
/**
 * Decodes a JWT token without verification (for use after API Gateway has already verified it)
 */
function decodeJWT(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            throw new Error('Invalid JWT format');
        }
        // Decode the payload (second part)
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        return payload;
    }
    catch (error) {
        throw new errors_1.AuthorizationError('Invalid JWT token');
    }
}
/**
 * Extracts user information from the request's JWT token
 */
function getUserFromToken(event) {
    const token = (0, request_validator_1.getAuthToken)(event);
    const payload = decodeJWT(token);
    // Try different fields for user ID (handle both custom:provider_id and custom:user_id)
    const userId = payload['custom:provider_id'] ||
        payload['custom:user_id'] ||
        payload.sub;
    if (!userId) {
        throw new errors_1.AuthorizationError('User ID not found in token');
    }
    return {
        userId,
        email: payload.email,
        firstName: payload.given_name,
        lastName: payload.family_name,
    };
}
/**
 * Gets the provider ID from the token (for backwards compatibility)
 */
function getProviderIdFromToken(event) {
    const { userId } = getUserFromToken(event);
    return userId;
}
//# sourceMappingURL=jwt.js.map