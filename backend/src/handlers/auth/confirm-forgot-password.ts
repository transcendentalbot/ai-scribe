import { APIGatewayProxyHandler } from 'aws-lambda';
import { ConfirmForgotPasswordSchema } from '../../types/auth';
import { cognitoService } from '../../utils/cognito';
import { response, AppError } from '../../utils/response';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // Parse and validate request body
    const body = JSON.parse(event.body || '{}');
    const validatedData = ConfirmForgotPasswordSchema.parse(body);

    // Confirm the new password with verification code
    try {
      await cognitoService.confirmForgotPassword(
        validatedData.email,
        validatedData.code,
        validatedData.newPassword
      );
    } catch (error: any) {
      if (error.name === 'CodeMismatchException') {
        throw new AppError('Invalid verification code', 400);
      }
      if (error.name === 'ExpiredCodeException') {
        throw new AppError('Verification code has expired', 400);
      }
      if (error.name === 'InvalidPasswordException') {
        throw new AppError('Password does not meet requirements', 400);
      }
      if (error.name === 'UserNotFoundException') {
        throw new AppError('Invalid request', 400);
      }
      throw error;
    }

    return response.success({
      message: 'Password reset successfully. You can now login with your new password.',
    });

  } catch (error: any) {
    console.error('Confirm forgot password error:', error);

    if (error.name === 'ZodError') {
      return response.error('Validation failed', 400, error.errors);
    }

    if (error instanceof AppError) {
      return response.error(error.message, error.statusCode, error.errors);
    }

    return response.error('Password reset confirmation failed', 500);
  }
};