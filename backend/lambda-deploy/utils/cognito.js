"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cognitoService = void 0;
const client_cognito_identity_provider_1 = require("@aws-sdk/client-cognito-identity-provider");
const cognito = new client_cognito_identity_provider_1.CognitoIdentityProviderClient({
    region: process.env.AWS_REGION || 'us-east-1',
});
const CLIENT_ID = process.env.USER_POOL_CLIENT_ID;
const USER_POOL_ID = process.env.USER_POOL_ID;
exports.cognitoService = {
    async signUp(email, password, attributes) {
        const command = new client_cognito_identity_provider_1.SignUpCommand({
            ClientId: CLIENT_ID,
            Username: email,
            Password: password,
            UserAttributes: Object.entries(attributes).map(([Name, Value]) => ({
                Name,
                Value,
            })),
        });
        return cognito.send(command);
    },
    async confirmSignUp(email, code) {
        const command = new client_cognito_identity_provider_1.ConfirmSignUpCommand({
            ClientId: CLIENT_ID,
            Username: email,
            ConfirmationCode: code,
        });
        return cognito.send(command);
    },
    async signIn(email, password) {
        const command = new client_cognito_identity_provider_1.InitiateAuthCommand({
            ClientId: CLIENT_ID,
            AuthFlow: 'USER_PASSWORD_AUTH',
            AuthParameters: {
                USERNAME: email,
                PASSWORD: password,
            },
        });
        return cognito.send(command);
    },
    async refreshToken(refreshToken) {
        const command = new client_cognito_identity_provider_1.InitiateAuthCommand({
            ClientId: CLIENT_ID,
            AuthFlow: 'REFRESH_TOKEN_AUTH',
            AuthParameters: {
                REFRESH_TOKEN: refreshToken,
            },
        });
        return cognito.send(command);
    },
    async forgotPassword(email) {
        const command = new client_cognito_identity_provider_1.ForgotPasswordCommand({
            ClientId: CLIENT_ID,
            Username: email,
        });
        return cognito.send(command);
    },
    async confirmForgotPassword(email, code, newPassword) {
        const command = new client_cognito_identity_provider_1.ConfirmForgotPasswordCommand({
            ClientId: CLIENT_ID,
            Username: email,
            ConfirmationCode: code,
            Password: newPassword,
        });
        return cognito.send(command);
    },
    async getUser(accessToken) {
        const command = new client_cognito_identity_provider_1.GetUserCommand({
            AccessToken: accessToken,
        });
        return cognito.send(command);
    },
    async signOut(accessToken) {
        const command = new client_cognito_identity_provider_1.GlobalSignOutCommand({
            AccessToken: accessToken,
        });
        return cognito.send(command);
    },
    async updateUserAttributes(username, attributes) {
        const command = new client_cognito_identity_provider_1.AdminUpdateUserAttributesCommand({
            UserPoolId: USER_POOL_ID,
            Username: username,
            UserAttributes: Object.entries(attributes).map(([Name, Value]) => ({
                Name,
                Value,
            })),
        });
        return cognito.send(command);
    },
};
//# sourceMappingURL=cognito.js.map