"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const auth_1 = require("../../types/auth");
const cognito_1 = require("../../utils/cognito");
const response_1 = require("../../utils/response");
const handler = async (event) => {
    try {
        // Parse and validate request body
        const body = JSON.parse(event.body || '{}');
        const validatedData = auth_1.RefreshTokenSchema.parse(body);
        // Refresh tokens with Cognito
        let authResult;
        try {
            authResult = await cognito_1.cognitoService.refreshToken(validatedData.refreshToken);
        }
        catch (error) {
            if (error.name === 'NotAuthorizedException') {
                throw new response_1.AppError('Invalid refresh token', 401);
            }
            throw error;
        }
        if (!authResult.AuthenticationResult) {
            throw new response_1.AppError('Token refresh failed', 401);
        }
        return response_1.response.success({
            tokens: {
                accessToken: authResult.AuthenticationResult.AccessToken,
                idToken: authResult.AuthenticationResult.IdToken,
            },
        });
    }
    catch (error) {
        console.error('Refresh token error:', error);
        if (error.name === 'ZodError') {
            return response_1.response.error('Validation failed', 400, error.errors);
        }
        if (error instanceof response_1.AppError) {
            return response_1.response.error(error.message, error.statusCode, error.errors);
        }
        return response_1.response.error('Token refresh failed', 500);
    }
};
exports.handler = handler;
//# sourceMappingURL=refresh.js.map