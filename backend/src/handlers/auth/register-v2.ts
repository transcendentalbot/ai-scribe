import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { RegisterSchema } from '../../types/auth';
import { cognitoService } from '../../utils/cognito';
import { userService, dynamodb } from '../../utils/dynamodb';
import { response } from '../../utils/response';
import { errorHandler } from '../../middleware/error-handler';
import { validateBody } from '../../middleware/request-validator';
import { getCorrelationId, createLogContext } from '../../middleware/correlation-id';
import { logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';
import { ConflictError, BusinessLogicError } from '../../errors';
import { PutCommand } from '@aws-sdk/lib-dynamodb';

/**
 * Enhanced registration handler with comprehensive error handling
 */
const registerHandler = async (event: APIGatewayProxyEvent, context: Context) => {
  const startTime = Date.now();
  const correlationId = getCorrelationId(event);
  const logContext = createLogContext(event, correlationId);

  logger.info('Registration attempt started', logContext);

  // Validate request body
  const validatedData = validateBody(event, RegisterSchema);
  
  // Generate user ID
  const userId = uuidv4();
  
  try {
    // Register user in Cognito
    logger.info('Creating Cognito user', { ...logContext, email: validatedData.email });
    
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

    logger.info('Cognito user created successfully', { ...logContext, userId });

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

    // Record metrics
    metrics.success('UserRegistration', { UserType: 'Provider' });
    metrics.authAttempt(true, 'Register');
    metrics.duration('RegistrationDuration', startTime);

    // Log audit event
    logger.audit('USER_CREATED', userId, userId, {
      email: validatedData.email,
      organization: validatedData.organization,
    });

    return response.success({
      message: 'Registration successful. Please check your email for verification code.',
      userId: userId,
      correlationId,
    }, 201);

  } catch (error: any) {
    // Record failure metrics
    metrics.failure('UserRegistration', error.name || 'Unknown');
    metrics.authAttempt(false, 'Register', error.name);

    // Handle specific Cognito errors
    if (error.name === 'UsernameExistsException') {
      throw new ConflictError('An account with this email already exists');
    }

    if (error.name === 'InvalidPasswordException') {
      throw new BusinessLogicError(
        'Password does not meet requirements: minimum 12 characters, including uppercase, lowercase, number, and special character',
        400
      );
    }

    if (error.name === 'InvalidParameterException') {
      throw new BusinessLogicError('Invalid registration parameters', 400);
    }

    // Re-throw to be handled by error middleware
    throw error;
  }
};

// Export handler wrapped with error handling middleware
export const handler = errorHandler(registerHandler);