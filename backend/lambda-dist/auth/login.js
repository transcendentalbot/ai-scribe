"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const auth_1 = require("../../types/auth");
const cognito_1 = require("../../utils/cognito");
const dynamodb_1 = require("../../utils/dynamodb");
const response_1 = require("../../utils/response");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const handler = async (event) => {
    try {
        // Parse and validate request body
        const body = JSON.parse(event.body || '{}');
        const validatedData = auth_1.LoginSchema.parse(body);
        // Authenticate with Cognito
        let authResult;
        try {
            authResult = await cognito_1.cognitoService.signIn(validatedData.email, validatedData.password);
        }
        catch (error) {
            if (error.name === 'NotAuthorizedException') {
                throw new response_1.AppError('Invalid email or password', 401);
            }
            if (error.name === 'UserNotConfirmedException') {
                throw new response_1.AppError('Please verify your email before logging in', 403);
            }
            throw error;
        }
        if (!authResult.AuthenticationResult) {
            throw new response_1.AppError('Authentication failed', 401);
        }
        // Decode the ID token to get user information
        const idToken = authResult.AuthenticationResult.IdToken;
        const decodedToken = jsonwebtoken_1.default.decode(idToken);
        const userId = decodedToken['custom:provider_id'] || decodedToken['custom:user_id'] || decodedToken.sub;
        // Get user from DynamoDB
        const user = await dynamodb_1.userService.getUser(userId);
        if (!user) {
            throw new response_1.AppError('User not found', 404);
        }
        // Update last login
        await dynamodb_1.userService.updateLastLogin(userId);
        // Prepare response
        const authResponse = {
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
                accessToken: authResult.AuthenticationResult.AccessToken,
                refreshToken: authResult.AuthenticationResult.RefreshToken,
                idToken: authResult.AuthenticationResult.IdToken,
            },
        };
        return response_1.response.success(authResponse);
    }
    catch (error) {
        console.error('Login error:', error);
        if (error.name === 'ZodError') {
            return response_1.response.error('Validation failed', 400, error.errors);
        }
        if (error instanceof response_1.AppError) {
            return response_1.response.error(error.message, error.statusCode, error.errors);
        }
        return response_1.response.error('Login failed', 500);
    }
};
exports.handler = handler;
//# sourceMappingURL=login.js.map