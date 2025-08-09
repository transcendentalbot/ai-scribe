import { APIGatewayProxyHandler } from 'aws-lambda';
import { cognitoService } from '../../utils/cognito';
import { response, AppError } from '../../utils/response';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // Get access token from Authorization header
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No authorization token provided', 401);
    }

    const accessToken = authHeader.substring(7);

    // Sign out from Cognito (invalidates all tokens)
    try {
      await cognitoService.signOut(accessToken);
    } catch (error: any) {
      if (error.name === 'NotAuthorizedException') {
        // Token might already be invalid, which is fine for logout
        return response.success({ message: 'Logged out successfully' });
      }
      throw error;
    }

    return response.success({ message: 'Logged out successfully' });

  } catch (error: any) {
    console.error('Logout error:', error);

    if (error instanceof AppError) {
      return response.error(error.message, error.statusCode, error.errors);
    }

    return response.error('Logout failed', 500);
  }
};