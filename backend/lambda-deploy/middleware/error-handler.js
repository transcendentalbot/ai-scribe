"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const zod_1 = require("zod");
const response_1 = require("../utils/response");
const logger_1 = require("../utils/logger");
/**
 * Error handling middleware for Lambda functions
 * Wraps handlers to provide consistent error handling and logging
 */
const errorHandler = (handler) => {
    return async (event, context) => {
        const requestId = context.awsRequestId;
        const startTime = Date.now();
        try {
            // Log request
            logger_1.logger.info('Request received', {
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
            logger_1.logger.info('Request completed', {
                requestId,
                statusCode: result.statusCode,
                duration,
            });
            return result;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            // Log error with context
            logger_1.logger.error('Request failed', {
                requestId,
                error: {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                },
                duration,
            });
            // Handle different error types
            if (error instanceof zod_1.ZodError) {
                return response_1.response.error('Validation failed', 400, error.errors);
            }
            if (error instanceof response_1.AppError) {
                return response_1.response.error(error.message, error.statusCode, error.errors);
            }
            // AWS SDK errors
            if (error.name && error.$metadata) {
                const awsError = mapAwsError(error);
                return response_1.response.error(awsError.message, awsError.statusCode);
            }
            // Unknown errors - don't expose internal details
            return response_1.response.error('Internal server error', 500);
        }
    };
};
exports.errorHandler = errorHandler;
/**
 * Maps AWS SDK errors to appropriate HTTP responses
 */
function mapAwsError(error) {
    const errorMappings = {
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
//# sourceMappingURL=error-handler.js.map