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
        const validatedData = auth_1.ConfirmForgotPasswordSchema.parse(body);
        // Confirm the new password with verification code
        try {
            await cognito_1.cognitoService.confirmForgotPassword(validatedData.email, validatedData.code, validatedData.newPassword);
        }
        catch (error) {
            if (error.name === 'CodeMismatchException') {
                throw new response_1.AppError('Invalid verification code', 400);
            }
            if (error.name === 'ExpiredCodeException') {
                throw new response_1.AppError('Verification code has expired', 400);
            }
            if (error.name === 'InvalidPasswordException') {
                throw new response_1.AppError('Password does not meet requirements', 400);
            }
            if (error.name === 'UserNotFoundException') {
                throw new response_1.AppError('Invalid request', 400);
            }
            throw error;
        }
        return response_1.response.success({
            message: 'Password reset successfully. You can now login with your new password.',
        });
    }
    catch (error) {
        console.error('Confirm forgot password error:', error);
        if (error.name === 'ZodError') {
            return response_1.response.error('Validation failed', 400, error.errors);
        }
        if (error instanceof response_1.AppError) {
            return response_1.response.error(error.message, error.statusCode, error.errors);
        }
        return response_1.response.error('Password reset confirmation failed', 500);
    }
};
exports.handler = handler;
//# sourceMappingURL=confirm-forgot-password.js.map