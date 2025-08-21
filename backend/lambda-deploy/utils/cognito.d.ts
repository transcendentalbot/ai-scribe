export declare const cognitoService: {
    signUp(email: string, password: string, attributes: Record<string, string>): Promise<import("@aws-sdk/client-cognito-identity-provider").SignUpCommandOutput>;
    confirmSignUp(email: string, code: string): Promise<import("@aws-sdk/client-cognito-identity-provider").ConfirmSignUpCommandOutput>;
    signIn(email: string, password: string): Promise<import("@aws-sdk/client-cognito-identity-provider").InitiateAuthCommandOutput>;
    refreshToken(refreshToken: string): Promise<import("@aws-sdk/client-cognito-identity-provider").InitiateAuthCommandOutput>;
    forgotPassword(email: string): Promise<import("@aws-sdk/client-cognito-identity-provider").ForgotPasswordCommandOutput>;
    confirmForgotPassword(email: string, code: string, newPassword: string): Promise<import("@aws-sdk/client-cognito-identity-provider").ConfirmForgotPasswordCommandOutput>;
    getUser(accessToken: string): Promise<import("@aws-sdk/client-cognito-identity-provider").GetUserCommandOutput>;
    signOut(accessToken: string): Promise<import("@aws-sdk/client-cognito-identity-provider").GlobalSignOutCommandOutput>;
    updateUserAttributes(username: string, attributes: Record<string, string>): Promise<import("@aws-sdk/client-cognito-identity-provider").AdminUpdateUserAttributesCommandOutput>;
};
//# sourceMappingURL=cognito.d.ts.map