import { APIGatewayProxyHandler } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { RegisterSchema } from '../../types/auth';
import { cognitoService } from '../../utils/cognito';
import { userService, dynamodb } from '../../utils/dynamodb';
import { response, AppError } from '../../utils/response';
import { PutCommand } from '@aws-sdk/lib-dynamodb';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // Parse and validate request body
    const body = JSON.parse(event.body || '{}');
    const validatedData = RegisterSchema.parse(body);

    // Generate user ID
    const userId = uuidv4();

    // Register user in Cognito
    try {
      await cognitoService.signUp(validatedData.email, validatedData.password, {
        email: validatedData.email,
        given_name: validatedData.firstName,
        family_name: validatedData.lastName,
        phone_number: validatedData.phoneNumber || '',
        'custom:user_id': userId,
        'custom:license_number': validatedData.licenseNumber || '',
        'custom:specialty': validatedData.specialty || '',
        'custom:organization': validatedData.organization || '',
      });
    } catch (error: any) {
      if (error.name === 'UsernameExistsException') {
        throw new AppError('An account with this email already exists', 409);
      }
      throw error;
    }

    // Create user in DynamoDB
    const user = await userService.createUser({
      id: userId,
      email: validatedData.email.toLowerCase(),
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      phoneNumber: validatedData.phoneNumber,
      licenseNumber: validatedData.licenseNumber,
      specialty: validatedData.specialty,
      organization: validatedData.organization,
    } as any);

    // Create GSI entry for email lookup
    await dynamodb.send(
      new PutCommand({
        TableName: process.env.TABLE_NAME!,
        Item: {
          pk: `EMAIL#${validatedData.email.toLowerCase()}`,
          sk: `USER#${userId}`,
          gsi1pk: `EMAIL#${validatedData.email.toLowerCase()}`,
          gsi1sk: `USER#${userId}`,
          id: userId,
        },
      })
    );

    return response.success({
      message: 'Registration successful. Please check your email for verification code.',
      userId: userId,
    }, 201);

  } catch (error: any) {
    console.error('Registration error:', error);

    if (error.name === 'ZodError') {
      return response.error('Validation failed', 400, error.errors);
    }

    if (error instanceof AppError) {
      return response.error(error.message, error.statusCode, error.errors);
    }

    return response.error('Registration failed', 500);
  }
};