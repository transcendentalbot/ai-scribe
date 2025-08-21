"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const uuid_1 = require("uuid");
const auth_1 = require("../../types/auth");
const cognito_1 = require("../../utils/cognito");
const dynamodb_1 = require("../../utils/dynamodb");
const response_1 = require("../../utils/response");
const error_handler_1 = require("../../middleware/error-handler");
const request_validator_1 = require("../../middleware/request-validator");
const correlation_id_1 = require("../../middleware/correlation-id");
const logger_1 = require("../../utils/logger");
const metrics_1 = require("../../utils/metrics");
const errors_1 = require("../../errors");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
/**
 * Enhanced registration handler with comprehensive error handling
 */
const registerHandler = async (event, context) => {
    const startTime = Date.now();
    const correlationId = (0, correlation_id_1.getCorrelationId)(event);
    const logContext = (0, correlation_id_1.createLogContext)(event, correlationId);
    logger_1.logger.info('Registration attempt started', logContext);
    // Validate request body
    const validatedData = (0, request_validator_1.validateBody)(event, auth_1.RegisterSchema);
    // Generate user ID
    const userId = (0, uuid_1.v4)();
    try {
        // Register user in Cognito
        logger_1.logger.info('Creating Cognito user', { ...logContext, email: validatedData.email });
        await cognito_1.cognitoService.signUp(validatedData.email, validatedData.password, {
            email: validatedData.email,
            given_name: validatedData.firstName,
            family_name: validatedData.lastName,
            phone_number: validatedData.phoneNumber || '',
            'custom:user_id': userId,
            'custom:license_number': validatedData.licenseNumber || '',
            'custom:specialty': validatedData.specialty || '',
            'custom:organization': validatedData.organization || '',
        });
        logger_1.logger.info('Cognito user created successfully', { ...logContext, userId });
        // Create user in DynamoDB
        const user = await dynamodb_1.userService.createUser({
            id: userId,
            email: validatedData.email.toLowerCase(),
            firstName: validatedData.firstName,
            lastName: validatedData.lastName,
            phoneNumber: validatedData.phoneNumber,
            licenseNumber: validatedData.licenseNumber,
            specialty: validatedData.specialty,
            organization: validatedData.organization,
        });
        // Create GSI entry for email lookup
        await dynamodb_1.dynamodb.send(new lib_dynamodb_1.PutCommand({
            TableName: process.env.TABLE_NAME,
            Item: {
                pk: `EMAIL#${validatedData.email.toLowerCase()}`,
                sk: `USER#${userId}`,
                gsi1pk: `EMAIL#${validatedData.email.toLowerCase()}`,
                gsi1sk: `USER#${userId}`,
                id: userId,
            },
        }));
        // Record metrics
        metrics_1.metrics.success('UserRegistration', { UserType: 'Provider' });
        metrics_1.metrics.authAttempt(true, 'Register');
        metrics_1.metrics.duration('RegistrationDuration', startTime);
        // Log audit event
        logger_1.logger.audit('USER_CREATED', userId, userId, {
            email: validatedData.email,
            organization: validatedData.organization,
        });
        return response_1.response.success({
            message: 'Registration successful. Please check your email for verification code.',
            userId: userId,
            correlationId,
        }, 201);
    }
    catch (error) {
        // Record failure metrics
        metrics_1.metrics.failure('UserRegistration', error.name || 'Unknown');
        metrics_1.metrics.authAttempt(false, 'Register', error.name);
        // Handle specific Cognito errors
        if (error.name === 'UsernameExistsException') {
            throw new errors_1.ConflictError('An account with this email already exists');
        }
        if (error.name === 'InvalidPasswordException') {
            throw new errors_1.BusinessLogicError('Password does not meet requirements: minimum 12 characters, including uppercase, lowercase, number, and special character', 400);
        }
        if (error.name === 'InvalidParameterException') {
            throw new errors_1.BusinessLogicError('Invalid registration parameters', 400);
        }
        // Re-throw to be handled by error middleware
        throw error;
    }
};
// Export handler wrapped with error handling middleware
exports.handler = (0, error_handler_1.errorHandler)(registerHandler);
//# sourceMappingURL=register-v2.js.map