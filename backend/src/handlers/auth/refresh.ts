import { APIGatewayProxyHandler } from 'aws-lambda';
import { RefreshTokenSchema } from '../../types/auth';
import { cognitoService } from '../../utils/cognito';
import { response, AppError } from '../../utils/response';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // Parse and validate request body
    const body = JSON.parse(event.body || '{}');
    const validatedData = RefreshTokenSchema.parse(body);

    // Refresh tokens with Cognito
    let authResult;
    try {
      authResult = await cognitoService.refreshToken(validatedData.refreshToken);
    } catch (error: any) {
      if (error.name === 'NotAuthorizedException') {
        throw new AppError('Invalid refresh token', 401);
      }
      throw error;
    }

    if (!authResult.AuthenticationResult) {
      throw new AppError('Token refresh failed', 401);
    }

    return response.success({
      tokens: {
        accessToken: authResult.AuthenticationResult.AccessToken!,
        idToken: authResult.AuthenticationResult.IdToken!,
      },
    });

  } catch (error: any) {
    console.error('Refresh token error:', error);

    if (error.name === 'ZodError') {
      return response.error('Validation failed', 400, error.errors);
    }

    if (error instanceof AppError) {
      return response.error(error.message, error.statusCode, error.errors);
    }

    return response.error('Token refresh failed', 500);
  }
};