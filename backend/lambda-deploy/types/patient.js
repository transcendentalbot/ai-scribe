"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdatePatientSchema = exports.CreatePatientSchema = exports.PatientSearchSchema = exports.PatientSchema = void 0;
const zod_1 = require("zod");
// Patient schemas
exports.PatientSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    mrn: zod_1.z.string().min(1), // Medical Record Number
    firstName: zod_1.z.string().min(1),
    lastName: zod_1.z.string().min(1),
    dateOfBirth: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    gender: zod_1.z.enum(['Male', 'Female', 'Other', 'Unknown']),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().optional(),
    address: zod_1.z.object({
        street: zod_1.z.string().optional(),
        city: zod_1.z.string().optional(),
        state: zod_1.z.string().optional(),
        zipCode: zod_1.z.string().optional(),
        country: zod_1.z.string().optional(),
    }).optional(),
    emergencyContact: zod_1.z.object({
        name: zod_1.z.string(),
        relationship: zod_1.z.string(),
        phone: zod_1.z.string(),
    }).optional(),
    insuranceInfo: zod_1.z.object({
        provider: zod_1.z.string(),
        policyNumber: zod_1.z.string(),
        groupNumber: zod_1.z.string().optional(),
    }).optional(),
    allergies: zod_1.z.array(zod_1.z.string()).optional(),
    medications: zod_1.z.array(zod_1.z.string()).optional(),
    conditions: zod_1.z.array(zod_1.z.string()).optional(),
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string(),
    createdBy: zod_1.z.string(), // Provider ID who created the record
    lastModifiedBy: zod_1.z.string(), // Provider ID who last modified
});
exports.PatientSearchSchema = zod_1.z.object({
    query: zod_1.z.string().min(2), // Search by name, MRN, DOB
    limit: zod_1.z.union([zod_1.z.string().regex(/^\d+$/).transform(Number), zod_1.z.number()]).optional().default(20),
    nextToken: zod_1.z.string().optional(),
});
exports.CreatePatientSchema = exports.PatientSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdBy: true,
    lastModifiedBy: true,
});
exports.UpdatePatientSchema = exports.CreatePatientSchema.partial();
//# sourceMappingURL=patient.js.map