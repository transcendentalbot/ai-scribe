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
        const validatedData = auth_1.ForgotPasswordSchema.parse(body);
        // Initiate forgot password flow
        try {
            await cognito_1.cognitoService.forgotPassword(validatedData.email);
        }
        catch (error) {
            if (error.name === 'UserNotFoundException') {
                // Don't reveal if user exists or not for security
                return response_1.response.success({
                    message: 'If an account exists with this email, you will receive a password reset code.',
                });
            }
            throw error;
        }
        return response_1.response.success({
            message: 'If an account exists with this email, you will receive a password reset code.',
        });
    }
    catch (error) {
        console.error('Forgot password error:', error);
        if (error.name === 'ZodError') {
            return response_1.response.error('Validation failed', 400, error.errors);
        }
        if (error instanceof response_1.AppError) {
            return response_1.response.error(error.message, error.statusCode, error.errors);
        }
        return response_1.response.error('Password reset request failed', 500);
    }
};
exports.handler = handler;
//# sourceMappingURL=forgot-password.js.map