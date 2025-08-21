"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateEncounterStatusSchema = exports.DailyEncounterListSchema = exports.CaptureConsentSchema = exports.UpdateEncounterSchema = exports.CreateEncounterSchema = exports.EncounterSchema = exports.ConsentType = exports.EncounterStatus = void 0;
const zod_1 = require("zod");
// Encounter status workflow
var EncounterStatus;
(function (EncounterStatus) {
    EncounterStatus["SCHEDULED"] = "SCHEDULED";
    EncounterStatus["CHECKED_IN"] = "CHECKED_IN";
    EncounterStatus["IN_PROGRESS"] = "IN_PROGRESS";
    EncounterStatus["COMPLETED"] = "COMPLETED";
    EncounterStatus["CANCELLED"] = "CANCELLED";
    EncounterStatus["NO_SHOW"] = "NO_SHOW";
})(EncounterStatus || (exports.EncounterStatus = EncounterStatus = {}));
// Consent types
var ConsentType;
(function (ConsentType) {
    ConsentType["RECORDING"] = "RECORDING";
    ConsentType["DATA_SHARING"] = "DATA_SHARING";
    ConsentType["TREATMENT"] = "TREATMENT";
})(ConsentType || (exports.ConsentType = ConsentType = {}));
// Encounter schemas
exports.EncounterSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    patientId: zod_1.z.string().uuid(),
    providerId: zod_1.z.string().uuid(),
    organizationId: zod_1.z.string().optional(),
    scheduledAt: zod_1.z.string(), // ISO datetime
    startedAt: zod_1.z.string().optional(),
    completedAt: zod_1.z.string().optional(),
    status: zod_1.z.nativeEnum(EncounterStatus),
    type: zod_1.z.enum(['NEW_PATIENT', 'FOLLOW_UP', 'SICK_VISIT', 'WELLNESS_CHECK']),
    chiefComplaint: zod_1.z.string().optional(),
    reasonForVisit: zod_1.z.string().optional(),
    location: zod_1.z.object({
        facilityName: zod_1.z.string(),
        roomNumber: zod_1.z.string().optional(),
        department: zod_1.z.string().optional(),
    }).optional(),
    vitals: zod_1.z.object({
        bloodPressure: zod_1.z.string().optional(),
        heartRate: zod_1.z.number().optional(),
        temperature: zod_1.z.number().optional(),
        weight: zod_1.z.number().optional(),
        height: zod_1.z.number().optional(),
        respiratoryRate: zod_1.z.number().optional(),
        oxygenSaturation: zod_1.z.number().optional(),
    }).optional(),
    consents: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.nativeEnum(ConsentType),
        granted: zod_1.z.boolean(),
        grantedAt: zod_1.z.string(),
        grantedBy: zod_1.z.string(), // Patient or guardian ID
        expiresAt: zod_1.z.string().optional(),
        notes: zod_1.z.string().optional(),
    })).optional(),
    recordings: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        startTime: zod_1.z.string(),
        endTime: zod_1.z.string(),
        duration: zod_1.z.number(),
        s3Key: zod_1.z.string(),
        transcriptionId: zod_1.z.string().optional(),
    })).optional(),
    notes: zod_1.z.string().optional(),
    diagnoses: zod_1.z.array(zod_1.z.object({
        code: zod_1.z.string(),
        description: zod_1.z.string(),
        type: zod_1.z.enum(['PRIMARY', 'SECONDARY']),
    })).optional(),
    procedures: zod_1.z.array(zod_1.z.object({
        code: zod_1.z.string(),
        description: zod_1.z.string(),
        performedAt: zod_1.z.string(),
    })).optional(),
    medications: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        dosage: zod_1.z.string(),
        frequency: zod_1.z.string(),
        startDate: zod_1.z.string(),
        endDate: zod_1.z.string().optional(),
    })).optional(),
    followUpInstructions: zod_1.z.string().optional(),
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string(),
    createdBy: zod_1.z.string(),
    lastModifiedBy: zod_1.z.string(),
});
exports.CreateEncounterSchema = zod_1.z.object({
    patientId: zod_1.z.string().uuid().optional(), // Optional for new patient creation
    patientName: zod_1.z.string().min(1, 'Patient name is required').optional(),
    patientMRN: zod_1.z.string().min(1, 'MRN is required').optional(),
    patientBirthdate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
    type: zod_1.z.enum(['NEW_PATIENT', 'FOLLOW_UP', 'SICK_VISIT', 'WELLNESS_CHECK']),
    consentObtained: zod_1.z.boolean().default(false),
    scheduledAt: zod_1.z.string().optional(), // Optional for immediate encounters
});
exports.UpdateEncounterSchema = exports.CreateEncounterSchema.partial().extend({
    status: zod_1.z.nativeEnum(EncounterStatus).optional(),
    vitals: exports.EncounterSchema.shape.vitals.optional(),
    notes: zod_1.z.string().optional(),
    diagnoses: exports.EncounterSchema.shape.diagnoses.optional(),
    procedures: exports.EncounterSchema.shape.procedures.optional(),
    medications: exports.EncounterSchema.shape.medications.optional(),
    followUpInstructions: zod_1.z.string().optional(),
    consents: exports.EncounterSchema.shape.consents.optional(),
    recordings: exports.EncounterSchema.shape.recordings.optional(),
});
exports.CaptureConsentSchema = zod_1.z.object({
    type: zod_1.z.nativeEnum(ConsentType),
    granted: zod_1.z.boolean(),
    notes: zod_1.z.string().optional(),
    expiresAt: zod_1.z.string().optional(),
});
exports.DailyEncounterListSchema = zod_1.z.object({
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // Defaults to today
    providerId: zod_1.z.string().uuid().optional(), // If not provided, uses current user
    status: zod_1.z.nativeEnum(EncounterStatus).optional(),
    limit: zod_1.z.union([zod_1.z.string().regex(/^\d+$/).transform(Number), zod_1.z.number()]).optional().default(50),
    nextToken: zod_1.z.string().optional(),
});
exports.UpdateEncounterStatusSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(EncounterStatus),
    notes: zod_1.z.string().optional(),
});
//# sourceMappingURL=encounter.js.map