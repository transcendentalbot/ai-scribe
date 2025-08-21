"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const cognito_1 = require("../../utils/cognito");
const dynamodb_1 = require("../../utils/dynamodb");
const response_1 = require("../../utils/response");
const handler = async (event) => {
    try {
        // Get access token from Authorization header
        const authHeader = event.headers.Authorization || event.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new response_1.AppError('No authorization token provided', 401);
        }
        const accessToken = authHeader.substring(7);
        // Get user info from Cognito
        let cognitoUser;
        try {
            cognitoUser = await cognito_1.cognitoService.getUser(accessToken);
        }
        catch (error) {
            if (error.name === 'NotAuthorizedException') {
                throw new response_1.AppError('Invalid or expired token', 401);
            }
            throw error;
        }
        // Extract user ID from Cognito attributes
        const userIdAttribute = cognitoUser.UserAttributes?.find(attr => attr.Name === 'custom:provider_id' || attr.Name === 'custom:user_id');
        const userId = userIdAttribute?.Value || cognitoUser.Username;
        if (!userId) {
            throw new response_1.AppError('User ID not found', 500);
        }
        // Get user from DynamoDB
        const user = await dynamodb_1.userService.getUser(userId);
        if (!user) {
            throw new response_1.AppError('User not found', 404);
        }
        // Return user data
        return response_1.response.success({
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                phoneNumber: user.phoneNumber,
                licenseNumber: user.licenseNumber,
                specialty: user.specialty,
                organization: user.organization,
                emailVerified: user.emailVerified,
                mfaEnabled: user.mfaEnabled,
                createdAt: user.createdAt,
                lastLoginAt: user.lastLoginAt,
            }
        });
    }
    catch (error) {
        console.error('Get user error:', error);
        if (error instanceof response_1.AppError) {
            return response_1.response.error(error.message, error.statusCode, error.errors);
        }
        return response_1.response.error('Failed to get user information', 500);
    }
};
exports.handler = handler;
//# sourceMappingURL=me.js.map