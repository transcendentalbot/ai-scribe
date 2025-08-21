import { z } from 'zod';
export declare enum EncounterStatus {
    SCHEDULED = "SCHEDULED",
    CHECKED_IN = "CHECKED_IN",
    IN_PROGRESS = "IN_PROGRESS",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED",
    NO_SHOW = "NO_SHOW"
}
export declare enum ConsentType {
    RECORDING = "RECORDING",
    DATA_SHARING = "DATA_SHARING",
    TREATMENT = "TREATMENT"
}
export declare const EncounterSchema: z.ZodObject<{
    id: z.ZodString;
    patientId: z.ZodString;
    providerId: z.ZodString;
    organizationId: z.ZodOptional<z.ZodString>;
    scheduledAt: z.ZodString;
    startedAt: z.ZodOptional<z.ZodString>;
    completedAt: z.ZodOptional<z.ZodString>;
    status: z.ZodNativeEnum<typeof EncounterStatus>;
    type: z.ZodEnum<["NEW_PATIENT", "FOLLOW_UP", "SICK_VISIT", "WELLNESS_CHECK"]>;
    chiefComplaint: z.ZodOptional<z.ZodString>;
    reasonForVisit: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodObject<{
        facilityName: z.ZodString;
        roomNumber: z.ZodOptional<z.ZodString>;
        department: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        facilityName: string;
        roomNumber?: string | undefined;
        department?: string | undefined;
    }, {
        facilityName: string;
        roomNumber?: string | undefined;
        department?: string | undefined;
    }>>;
    vitals: z.ZodOptional<z.ZodObject<{
        bloodPressure: z.ZodOptional<z.ZodString>;
        heartRate: z.ZodOptional<z.ZodNumber>;
        temperature: z.ZodOptional<z.ZodNumber>;
        weight: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
        respiratoryRate: z.ZodOptional<z.ZodNumber>;
        oxygenSaturation: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        bloodPressure?: string | undefined;
        heartRate?: number | undefined;
        temperature?: number | undefined;
        weight?: number | undefined;
        height?: number | undefined;
        respiratoryRate?: number | undefined;
        oxygenSaturation?: number | undefined;
    }, {
        bloodPressure?: string | undefined;
        heartRate?: number | undefined;
        temperature?: number | undefined;
        weight?: number | undefined;
        height?: number | undefined;
        respiratoryRate?: number | undefined;
        oxygenSaturation?: number | undefined;
    }>>;
    consents: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodNativeEnum<typeof ConsentType>;
        granted: z.ZodBoolean;
        grantedAt: z.ZodString;
        grantedBy: z.ZodString;
        expiresAt: z.ZodOptional<z.ZodString>;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: ConsentType;
        granted: boolean;
        grantedAt: string;
        grantedBy: string;
        expiresAt?: string | undefined;
        notes?: string | undefined;
    }, {
        type: ConsentType;
        granted: boolean;
        grantedAt: string;
        grantedBy: string;
        expiresAt?: string | undefined;
        notes?: string | undefined;
    }>, "many">>;
    recordings: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        startTime: z.ZodString;
        endTime: z.ZodString;
        duration: z.ZodNumber;
        s3Key: z.ZodString;
        transcriptionId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        duration: number;
        startTime: string;
        endTime: string;
        s3Key: string;
        transcriptionId?: string | undefined;
    }, {
        id: string;
        duration: number;
        startTime: string;
        endTime: string;
        s3Key: string;
        transcriptionId?: string | undefined;
    }>, "many">>;
    notes: z.ZodOptional<z.ZodString>;
    diagnoses: z.ZodOptional<z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        description: z.ZodString;
        type: z.ZodEnum<["PRIMARY", "SECONDARY"]>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        type: "PRIMARY" | "SECONDARY";
        description: string;
    }, {
        code: string;
        type: "PRIMARY" | "SECONDARY";
        description: string;
    }>, "many">>;
    procedures: z.ZodOptional<z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        description: z.ZodString;
        performedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        code: string;
        description: string;
        performedAt: string;
    }, {
        code: string;
        description: string;
        performedAt: string;
    }>, "many">>;
    medications: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        dosage: z.ZodString;
        frequency: z.ZodString;
        startDate: z.ZodString;
        endDate: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        dosage: string;
        frequency: string;
        startDate: string;
        endDate?: string | undefined;
    }, {
        name: string;
        dosage: string;
        frequency: string;
        startDate: string;
        endDate?: string | undefined;
    }>, "many">>;
    followUpInstructions: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    createdBy: z.ZodString;
    lastModifiedBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "NEW_PATIENT" | "FOLLOW_UP" | "SICK_VISIT" | "WELLNESS_CHECK";
    status: EncounterStatus;
    id: string;
    createdAt: string;
    updatedAt: string;
    patientId: string;
    providerId: string;
    scheduledAt: string;
    createdBy: string;
    lastModifiedBy: string;
    organizationId?: string | undefined;
    startedAt?: string | undefined;
    completedAt?: string | undefined;
    chiefComplaint?: string | undefined;
    reasonForVisit?: string | undefined;
    location?: {
        facilityName: string;
        roomNumber?: string | undefined;
        department?: string | undefined;
    } | undefined;
    vitals?: {
        bloodPressure?: string | undefined;
        heartRate?: number | undefined;
        temperature?: number | undefined;
        weight?: number | undefined;
        height?: number | undefined;
        respiratoryRate?: number | undefined;
        oxygenSaturation?: number | undefined;
    } | undefined;
    notes?: string | undefined;
    consents?: {
        type: ConsentType;
        granted: boolean;
        grantedAt: string;
        grantedBy: string;
        expiresAt?: string | undefined;
        notes?: string | undefined;
    }[] | undefined;
    recordings?: {
        id: string;
        duration: number;
        startTime: string;
        endTime: string;
        s3Key: string;
        transcriptionId?: string | undefined;
    }[] | undefined;
    diagnoses?: {
        code: string;
        type: "PRIMARY" | "SECONDARY";
        description: string;
    }[] | undefined;
    procedures?: {
        code: string;
        description: string;
        performedAt: string;
    }[] | undefined;
    medications?: {
        name: string;
        dosage: string;
        frequency: string;
        startDate: string;
        endDate?: string | undefined;
    }[] | undefined;
    followUpInstructions?: string | undefined;
}, {
    type: "NEW_PATIENT" | "FOLLOW_UP" | "SICK_VISIT" | "WELLNESS_CHECK";
    status: EncounterStatus;
    id: string;
    createdAt: string;
    updatedAt: string;
    patientId: string;
    providerId: string;
    scheduledAt: string;
    createdBy: string;
    lastModifiedBy: string;
    organizationId?: string | undefined;
    startedAt?: string | undefined;
    completedAt?: string | undefined;
    chiefComplaint?: string | undefined;
    reasonForVisit?: string | undefined;
    location?: {
        facilityName: string;
        roomNumber?: string | undefined;
        department?: string | undefined;
    } | undefined;
    vitals?: {
        bloodPressure?: string | undefined;
        heartRate?: number | undefined;
        temperature?: number | undefined;
        weight?: number | undefined;
        height?: number | undefined;
        respiratoryRate?: number | undefined;
        oxygenSaturation?: number | undefined;
    } | undefined;
    notes?: string | undefined;
    consents?: {
        type: ConsentType;
        granted: boolean;
        grantedAt: string;
        grantedBy: string;
        expiresAt?: string | undefined;
        notes?: string | undefined;
    }[] | undefined;
    recordings?: {
        id: string;
        duration: number;
        startTime: string;
        endTime: string;
        s3Key: string;
        transcriptionId?: string | undefined;
    }[] | undefined;
    diagnoses?: {
        code: string;
        type: "PRIMARY" | "SECONDARY";
        description: string;
    }[] | undefined;
    procedures?: {
        code: string;
        description: string;
        performedAt: string;
    }[] | undefined;
    medications?: {
        name: string;
        dosage: string;
        frequency: string;
        startDate: string;
        endDate?: string | undefined;
    }[] | undefined;
    followUpInstructions?: string | undefined;
}>;
export declare const CreateEncounterSchema: z.ZodObject<{
    patientId: z.ZodOptional<z.ZodString>;
    patientName: z.ZodOptional<z.ZodString>;
    patientMRN: z.ZodOptional<z.ZodString>;
    patientBirthdate: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<["NEW_PATIENT", "FOLLOW_UP", "SICK_VISIT", "WELLNESS_CHECK"]>;
    consentObtained: z.ZodDefault<z.ZodBoolean>;
    scheduledAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "NEW_PATIENT" | "FOLLOW_UP" | "SICK_VISIT" | "WELLNESS_CHECK";
    consentObtained: boolean;
    patientId?: string | undefined;
    scheduledAt?: string | undefined;
    patientName?: string | undefined;
    patientMRN?: string | undefined;
    patientBirthdate?: string | undefined;
}, {
    type: "NEW_PATIENT" | "FOLLOW_UP" | "SICK_VISIT" | "WELLNESS_CHECK";
    patientId?: string | undefined;
    scheduledAt?: string | undefined;
    patientName?: string | undefined;
    patientMRN?: string | undefined;
    patientBirthdate?: string | undefined;
    consentObtained?: boolean | undefined;
}>;
export declare const UpdateEncounterSchema: z.ZodObject<{
    patientId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    patientName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    patientMRN: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    patientBirthdate: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    type: z.ZodOptional<z.ZodEnum<["NEW_PATIENT", "FOLLOW_UP", "SICK_VISIT", "WELLNESS_CHECK"]>>;
    consentObtained: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    scheduledAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
} & {
    status: z.ZodOptional<z.ZodNativeEnum<typeof EncounterStatus>>;
    vitals: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        bloodPressure: z.ZodOptional<z.ZodString>;
        heartRate: z.ZodOptional<z.ZodNumber>;
        temperature: z.ZodOptional<z.ZodNumber>;
        weight: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
        respiratoryRate: z.ZodOptional<z.ZodNumber>;
        oxygenSaturation: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        bloodPressure?: string | undefined;
        heartRate?: number | undefined;
        temperature?: number | undefined;
        weight?: number | undefined;
        height?: number | undefined;
        respiratoryRate?: number | undefined;
        oxygenSaturation?: number | undefined;
    }, {
        bloodPressure?: string | undefined;
        heartRate?: number | undefined;
        temperature?: number | undefined;
        weight?: number | undefined;
        height?: number | undefined;
        respiratoryRate?: number | undefined;
        oxygenSaturation?: number | undefined;
    }>>>;
    notes: z.ZodOptional<z.ZodString>;
    diagnoses: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        description: z.ZodString;
        type: z.ZodEnum<["PRIMARY", "SECONDARY"]>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        type: "PRIMARY" | "SECONDARY";
        description: string;
    }, {
        code: string;
        type: "PRIMARY" | "SECONDARY";
        description: string;
    }>, "many">>>;
    procedures: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        description: z.ZodString;
        performedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        code: string;
        description: string;
        performedAt: string;
    }, {
        code: string;
        description: string;
        performedAt: string;
    }>, "many">>>;
    medications: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        dosage: z.ZodString;
        frequency: z.ZodString;
        startDate: z.ZodString;
        endDate: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        dosage: string;
        frequency: string;
        startDate: string;
        endDate?: string | undefined;
    }, {
        name: string;
        dosage: string;
        frequency: string;
        startDate: string;
        endDate?: string | undefined;
    }>, "many">>>;
    followUpInstructions: z.ZodOptional<z.ZodString>;
    consents: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodNativeEnum<typeof ConsentType>;
        granted: z.ZodBoolean;
        grantedAt: z.ZodString;
        grantedBy: z.ZodString;
        expiresAt: z.ZodOptional<z.ZodString>;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: ConsentType;
        granted: boolean;
        grantedAt: string;
        grantedBy: string;
        expiresAt?: string | undefined;
        notes?: string | undefined;
    }, {
        type: ConsentType;
        granted: boolean;
        grantedAt: string;
        grantedBy: string;
        expiresAt?: string | undefined;
        notes?: string | undefined;
    }>, "many">>>;
    recordings: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        startTime: z.ZodString;
        endTime: z.ZodString;
        duration: z.ZodNumber;
        s3Key: z.ZodString;
        transcriptionId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        duration: number;
        startTime: string;
        endTime: string;
        s3Key: string;
        transcriptionId?: string | undefined;
    }, {
        id: string;
        duration: number;
        startTime: string;
        endTime: string;
        s3Key: string;
        transcriptionId?: string | undefined;
    }>, "many">>>;
}, "strip", z.ZodTypeAny, {
    type?: "NEW_PATIENT" | "FOLLOW_UP" | "SICK_VISIT" | "WELLNESS_CHECK" | undefined;
    status?: EncounterStatus | undefined;
    patientId?: string | undefined;
    scheduledAt?: string | undefined;
    vitals?: {
        bloodPressure?: string | undefined;
        heartRate?: number | undefined;
        temperature?: number | undefined;
        weight?: number | undefined;
        height?: number | undefined;
        respiratoryRate?: number | undefined;
        oxygenSaturation?: number | undefined;
    } | undefined;
    notes?: string | undefined;
    consents?: {
        type: ConsentType;
        granted: boolean;
        grantedAt: string;
        grantedBy: string;
        expiresAt?: string | undefined;
        notes?: string | undefined;
    }[] | undefined;
    recordings?: {
        id: string;
        duration: number;
        startTime: string;
        endTime: string;
        s3Key: string;
        transcriptionId?: string | undefined;
    }[] | undefined;
    diagnoses?: {
        code: string;
        type: "PRIMARY" | "SECONDARY";
        description: string;
    }[] | undefined;
    procedures?: {
        code: string;
        description: string;
        performedAt: string;
    }[] | undefined;
    medications?: {
        name: string;
        dosage: string;
        frequency: string;
        startDate: string;
        endDate?: string | undefined;
    }[] | undefined;
    followUpInstructions?: string | undefined;
    patientName?: string | undefined;
    patientMRN?: string | undefined;
    patientBirthdate?: string | undefined;
    consentObtained?: boolean | undefined;
}, {
    type?: "NEW_PATIENT" | "FOLLOW_UP" | "SICK_VISIT" | "WELLNESS_CHECK" | undefined;
    status?: EncounterStatus | undefined;
    patientId?: string | undefined;
    scheduledAt?: string | undefined;
    vitals?: {
        bloodPressure?: string | undefined;
        heartRate?: number | undefined;
        temperature?: number | undefined;
        weight?: number | undefined;
        height?: number | undefined;
        respiratoryRate?: number | undefined;
        oxygenSaturation?: number | undefined;
    } | undefined;
    notes?: string | undefined;
    consents?: {
        type: ConsentType;
        granted: boolean;
        grantedAt: string;
        grantedBy: string;
        expiresAt?: string | undefined;
        notes?: string | undefined;
    }[] | undefined;
    recordings?: {
        id: string;
        duration: number;
        startTime: string;
        endTime: string;
        s3Key: string;
        transcriptionId?: string | undefined;
    }[] | undefined;
    diagnoses?: {
        code: string;
        type: "PRIMARY" | "SECONDARY";
        description: string;
    }[] | undefined;
    procedures?: {
        code: string;
        description: string;
        performedAt: string;
    }[] | undefined;
    medications?: {
        name: string;
        dosage: string;
        frequency: string;
        startDate: string;
        endDate?: string | undefined;
    }[] | undefined;
    followUpInstructions?: string | undefined;
    patientName?: string | undefined;
    patientMRN?: string | undefined;
    patientBirthdate?: string | undefined;
    consentObtained?: boolean | undefined;
}>;
export declare const CaptureConsentSchema: z.ZodObject<{
    type: z.ZodNativeEnum<typeof ConsentType>;
    granted: z.ZodBoolean;
    notes: z.ZodOptional<z.ZodString>;
    expiresAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: ConsentType;
    granted: boolean;
    expiresAt?: string | undefined;
    notes?: string | undefined;
}, {
    type: ConsentType;
    granted: boolean;
    expiresAt?: string | undefined;
    notes?: string | undefined;
}>;
export declare const DailyEncounterListSchema: z.ZodObject<{
    date: z.ZodOptional<z.ZodString>;
    providerId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodNativeEnum<typeof EncounterStatus>>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, number, string>, z.ZodNumber]>>>;
    nextToken: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    status?: EncounterStatus | undefined;
    date?: string | undefined;
    providerId?: string | undefined;
    nextToken?: string | undefined;
}, {
    status?: EncounterStatus | undefined;
    date?: string | undefined;
    providerId?: string | undefined;
    limit?: string | number | undefined;
    nextToken?: string | undefined;
}>;
export declare const UpdateEncounterStatusSchema: z.ZodObject<{
    status: z.ZodNativeEnum<typeof EncounterStatus>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: EncounterStatus;
    notes?: string | undefined;
}, {
    status: EncounterStatus;
    notes?: string | undefined;
}>;
export type Encounter = z.infer<typeof EncounterSchema>;
export type CreateEncounterInput = z.infer<typeof CreateEncounterSchema>;
export type UpdateEncounterInput = z.infer<typeof UpdateEncounterSchema>;
export type CaptureConsentInput = z.infer<typeof CaptureConsentSchema>;
export type DailyEncounterListInput = z.infer<typeof DailyEncounterListSchema>;
export type UpdateEncounterStatusInput = z.infer<typeof UpdateEncounterStatusSchema>;
export interface EncounterEntity extends Encounter {
    pk: string;
    sk: string;
    gsi1pk?: string;
    gsi1sk?: string;
    gsi2pk?: string;
    gsi2sk?: string;
    gsi3pk?: string;
    gsi3sk?: string;
    entityType: 'ENCOUNTER';
}
//# sourceMappingURL=encounter.d.ts.map