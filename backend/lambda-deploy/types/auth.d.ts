import { z } from 'zod';
export declare const RegisterSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    phoneNumber: z.ZodOptional<z.ZodString>;
    licenseNumber: z.ZodOptional<z.ZodString>;
    specialty: z.ZodOptional<z.ZodString>;
    organization: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string | undefined;
    licenseNumber?: string | undefined;
    specialty?: string | undefined;
    organization?: string | undefined;
}, {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string | undefined;
    licenseNumber?: string | undefined;
    specialty?: string | undefined;
    organization?: string | undefined;
}>;
export declare const LoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const ForgotPasswordSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export declare const ConfirmForgotPasswordSchema: z.ZodObject<{
    email: z.ZodString;
    code: z.ZodString;
    newPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    code: string;
    newPassword: string;
}, {
    email: string;
    code: string;
    newPassword: string;
}>;
export declare const RefreshTokenSchema: z.ZodObject<{
    refreshToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    refreshToken: string;
}, {
    refreshToken: string;
}>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ConfirmForgotPasswordInput = z.infer<typeof ConfirmForgotPasswordSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;
export interface AuthResponse {
    user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        phoneNumber?: string;
        licenseNumber?: string;
        specialty?: string;
        organization?: string;
    };
    tokens: {
        accessToken: string;
        refreshToken: string;
        idToken: string;
    };
}
export interface User {
    pk: string;
    sk: string;
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    licenseNumber?: string;
    specialty?: string;
    organization?: string;
    createdAt: string;
    updatedAt: string;
    lastLoginAt?: string;
    emailVerified: boolean;
    mfaEnabled: boolean;
}
//# sourceMappingURL=auth.d.ts.map