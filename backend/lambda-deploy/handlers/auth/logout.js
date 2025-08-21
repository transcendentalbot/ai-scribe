"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const cognito_1 = require("../../utils/cognito");
const response_1 = require("../../utils/response");
const handler = async (event) => {
    try {
        // Get access token from Authorization header
        const authHeader = event.headers.Authorization || event.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new response_1.AppError('No authorization token provided', 401);
        }
        const accessToken = authHeader.substring(7);
        // Sign out from Cognito (invalidates all tokens)
        try {
            await cognito_1.cognitoService.signOut(accessToken);
        }
        catch (error) {
            if (error.name === 'NotAuthorizedException') {
                // Token might already be invalid, which is fine for logout
                return response_1.response.success({ message: 'Logged out successfully' });
            }
            throw error;
        }
        return response_1.response.success({ message: 'Logged out successfully' });
    }
    catch (error) {
        console.error('Logout error:', error);
        if (error instanceof response_1.AppError) {
            return response_1.response.error(error.message, error.statusCode, error.errors);
        }
        return response_1.response.error('Logout failed', 500);
    }
};
exports.handler = handler;
//# sourceMappingURL=logout.js.map