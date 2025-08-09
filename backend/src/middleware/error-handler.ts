import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { ZodError } from 'zod';
import { AppError, response } from '../utils/response';
import { logger } from '../utils/logger';

export interface HandlerFunction {
  (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult>;
}

/**
 * Error handling middleware for Lambda functions
 * Wraps handlers to provide consistent error handling and logging
 */
export const errorHandler = (handler: HandlerFunction): HandlerFunction => {
  return async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    const requestId = context.awsRequestId;
    const startTime = Date.now();

    try {
      // Log request
      logger.info('Request received', {
        requestId,
        method: event.httpMethod,
        path: event.path,
        headers: event.headers,
        queryParams: event.queryStringParameters,
      });

      // Execute handler
      const result = await handler(event, context);

      // Log response
      const duration = Date.now() - startTime;
      logger.info('Request completed', {
        requestId,
        statusCode: result.statusCode,
        duration,
      });

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      // Log error with context
      logger.error('Request failed', {
        requestId,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        duration,
      });

      // Handle different error types
      if (error instanceof ZodError) {
        return response.error('Validation failed', 400, error.errors);
      }

      if (error instanceof AppError) {
        return response.error(error.message, error.statusCode, error.errors);
      }

      // AWS SDK errors
      if (error.name && error.$metadata) {
        const awsError = mapAwsError(error);
        return response.error(awsError.message, awsError.statusCode);
      }

      // Unknown errors - don't expose internal details
      return response.error('Internal server error', 500);
    }
  };
};

/**
 * Maps AWS SDK errors to appropriate HTTP responses
 */
function mapAwsError(error: any): { message: string; statusCode: number } {
  const errorMappings: Record<string, { message: string; statusCode: number }> = {
    // Cognito errors
    NotAuthorizedException: { message: 'Invalid credentials', statusCode: 401 },
    UserNotFoundException: { message: 'User not found', statusCode: 404 },
    UsernameExistsException: { message: 'User already exists', statusCode: 409 },
    InvalidPasswordException: { message: 'Password does not meet requirements', statusCode: 400 },
    CodeMismatchException: { message: 'Invalid verification code', statusCode: 400 },
    ExpiredCodeException: { message: 'Verification code has expired', statusCode: 400 },
    TooManyRequestsException: { message: 'Too many requests, please try again later', statusCode: 429 },
    LimitExceededException: { message: 'Request limit exceeded', statusCode: 429 },
    UserNotConfirmedException: { message: 'Please verify your email before logging in', statusCode: 403 },
    
    // DynamoDB errors
    ConditionalCheckFailedException: { message: 'Operation failed due to a conflict', statusCode: 409 },
    ResourceNotFoundException: { message: 'Resource not found', statusCode: 404 },
    ValidationException: { message: 'Invalid request', statusCode: 400 },
    
    // S3 errors
    NoSuchKey: { message: 'File not found', statusCode: 404 },
    AccessDenied: { message: 'Access denied', statusCode: 403 },
    
    // Lambda errors
    ResourceConflictException: { message: 'Resource conflict', statusCode: 409 },
    ServiceException: { message: 'Service temporarily unavailable', statusCode: 503 },
  };

  const mapping = errorMappings[error.name];
  if (mapping) {
    return mapping;
  }

  // Default mapping based on error name patterns
  if (error.name.includes('NotFound')) {
    return { message: 'Resource not found', statusCode: 404 };
  }
  if (error.name.includes('Unauthorized') || error.name.includes('Forbidden')) {
    return { message: 'Unauthorized', statusCode: 401 };
  }
  if (error.name.includes('Invalid') || error.name.includes('Validation')) {
    return { message: 'Invalid request', statusCode: 400 };
  }

  return { message: 'An error occurred', statusCode: 500 };
}