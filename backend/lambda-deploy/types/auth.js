"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefreshTokenSchema = exports.ConfirmForgotPasswordSchema = exports.ForgotPasswordSchema = exports.LoginSchema = exports.RegisterSchema = void 0;
const zod_1 = require("zod");
exports.RegisterSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 'Password must contain uppercase, lowercase, number and special character'),
    firstName: zod_1.z.string().min(1),
    lastName: zod_1.z.string().min(1),
    phoneNumber: zod_1.z.string().optional(),
    // Medical provider specific fields
    licenseNumber: zod_1.z.string().optional(),
    specialty: zod_1.z.string().optional(),
    organization: zod_1.z.string().optional(),
});
exports.LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string(),
});
exports.ForgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
});
exports.ConfirmForgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    code: zod_1.z.string(),
    newPassword: zod_1.z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 'Password must contain uppercase, lowercase, number and special character'),
});
exports.RefreshTokenSchema = zod_1.z.object({
    refreshToken: zod_1.z.string(),
});
//# sourceMappingURL=auth.js.map