"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const uuid_1 = require("uuid");
const auth_1 = require("../../types/auth");
const cognito_1 = require("../../utils/cognito");
const dynamodb_1 = require("../../utils/dynamodb");
const response_1 = require("../../utils/response");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const handler = async (event) => {
    try {
        // Parse and validate request body
        const body = JSON.parse(event.body || '{}');
        const validatedData = auth_1.RegisterSchema.parse(body);
        // Generate user ID
        const userId = (0, uuid_1.v4)();
        // Register user in Cognito
        try {
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
        }
        catch (error) {
            if (error.name === 'UsernameExistsException') {
                throw new response_1.AppError('An account with this email already exists', 409);
            }
            throw error;
        }
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
        return response_1.response.success({
            message: 'Registration successful. Please check your email for verification code.',
            userId: userId,
        }, 201);
    }
    catch (error) {
        console.error('Registration error:', error);
        if (error.name === 'ZodError') {
            return response_1.response.error('Validation failed', 400, error.errors);
        }
        if (error instanceof response_1.AppError) {
            return response_1.response.error(error.message, error.statusCode, error.errors);
        }
        return response_1.response.error('Registration failed', 500);
    }
};
exports.handler = handler;
//# sourceMappingURL=register.js.map