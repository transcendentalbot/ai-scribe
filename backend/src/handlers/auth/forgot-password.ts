import { APIGatewayProxyHandler } from 'aws-lambda';
import { ForgotPasswordSchema } from '../../types/auth';
import { cognitoService } from '../../utils/cognito';
import { response, AppError } from '../../utils/response';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // Parse and validate request body
    const body = JSON.parse(event.body || '{}');
    const validatedData = ForgotPasswordSchema.parse(body);

    // Initiate forgot password flow
    try {
      await cognitoService.forgotPassword(validatedData.email);
    } catch (error: any) {
      if (error.name === 'UserNotFoundException') {
        // Don't reveal if user exists or not for security
        return response.success({
          message: 'If an account exists with this email, you will receive a password reset code.',
        });
      }
      throw error;
    }

    return response.success({
      message: 'If an account exists with this email, you will receive a password reset code.',
    });

  } catch (error: any) {
    console.error('Forgot password error:', error);

    if (error.name === 'ZodError') {
      return response.error('Validation failed', 400, error.errors);
    }

    if (error instanceof AppError) {
      return response.error(error.message, error.statusCode, error.errors);
    }

    return response.error('Password reset request failed', 500);
  }
};