import { APIGatewayProxyHandler } from 'aws-lambda';
import { cognitoService } from '../../utils/cognito';
import { userService } from '../../utils/dynamodb';
import { response, AppError } from '../../utils/response';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // Get access token from Authorization header
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No authorization token provided', 401);
    }

    const accessToken = authHeader.substring(7);

    // Get user info from Cognito
    let cognitoUser;
    try {
      cognitoUser = await cognitoService.getUser(accessToken);
    } catch (error: any) {
      if (error.name === 'NotAuthorizedException') {
        throw new AppError('Invalid or expired token', 401);
      }
      throw error;
    }

    // Extract user ID from Cognito attributes
    const userIdAttribute = cognitoUser.UserAttributes?.find(
      attr => attr.Name === 'custom:user_id'
    );
    
    if (!userIdAttribute?.Value) {
      throw new AppError('User ID not found', 500);
    }

    // Get user from DynamoDB
    const user = await userService.getUser(userIdAttribute.Value);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Return user data
    return response.success({
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
    });

  } catch (error: any) {
    console.error('Get user error:', error);

    if (error instanceof AppError) {
      return response.error(error.message, error.statusCode, error.errors);
    }

    return response.error('Failed to get user information', 500);
  }
};