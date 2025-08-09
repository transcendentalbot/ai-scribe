import { APIGatewayProxyHandler } from 'aws-lambda';
import { LoginSchema, AuthResponse } from '../../types/auth';
import { cognitoService } from '../../utils/cognito';
import { userService } from '../../utils/dynamodb';
import { response, AppError } from '../../utils/response';
import jwt from 'jsonwebtoken';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // Parse and validate request body
    const body = JSON.parse(event.body || '{}');
    const validatedData = LoginSchema.parse(body);

    // Authenticate with Cognito
    let authResult;
    try {
      authResult = await cognitoService.signIn(
        validatedData.email,
        validatedData.password
      );
    } catch (error: any) {
      if (error.name === 'NotAuthorizedException') {
        throw new AppError('Invalid email or password', 401);
      }
      if (error.name === 'UserNotConfirmedException') {
        throw new AppError('Please verify your email before logging in', 403);
      }
      throw error;
    }

    if (!authResult.AuthenticationResult) {
      throw new AppError('Authentication failed', 401);
    }

    // Decode the ID token to get user information
    const idToken = authResult.AuthenticationResult.IdToken!;
    const decodedToken = jwt.decode(idToken) as any;
    const userId = decodedToken['custom:user_id'];

    // Get user from DynamoDB
    const user = await userService.getUser(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Update last login
    await userService.updateLastLogin(userId);

    // Prepare response
    const authResponse: AuthResponse = {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        licenseNumber: user.licenseNumber,
        specialty: user.specialty,
        organization: user.organization,
      },
      tokens: {
        accessToken: authResult.AuthenticationResult.AccessToken!,
        refreshToken: authResult.AuthenticationResult.RefreshToken!,
        idToken: authResult.AuthenticationResult.IdToken!,
      },
    };

    return response.success(authResponse);

  } catch (error: any) {
    console.error('Login error:', error);

    if (error.name === 'ZodError') {
      return response.error('Validation failed', 400, error.errors);
    }

    if (error instanceof AppError) {
      return response.error(error.message, error.statusCode, error.errors);
    }

    return response.error('Login failed', 500);
  }
};