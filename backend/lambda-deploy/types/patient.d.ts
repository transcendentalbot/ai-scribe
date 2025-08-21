import { z } from 'zod';
export declare const PatientSchema: z.ZodObject<{
    id: z.ZodString;
    mrn: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    dateOfBirth: z.ZodString;
    gender: z.ZodEnum<["Male", "Female", "Other", "Unknown"]>;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodObject<{
        street: z.ZodOptional<z.ZodString>;
        city: z.ZodOptional<z.ZodString>;
        state: z.ZodOptional<z.ZodString>;
        zipCode: z.ZodOptional<z.ZodString>;
        country: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        street?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        zipCode?: string | undefined;
        country?: string | undefined;
    }, {
        street?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        zipCode?: string | undefined;
        country?: string | undefined;
    }>>;
    emergencyContact: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        relationship: z.ZodString;
        phone: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        phone: string;
        relationship: string;
    }, {
        name: string;
        phone: string;
        relationship: string;
    }>>;
    insuranceInfo: z.ZodOptional<z.ZodObject<{
        provider: z.ZodString;
        policyNumber: z.ZodString;
        groupNumber: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        provider: string;
        policyNumber: string;
        groupNumber?: string | undefined;
    }, {
        provider: string;
        policyNumber: string;
        groupNumber?: string | undefined;
    }>>;
    allergies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    medications: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    conditions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    createdBy: z.ZodString;
    lastModifiedBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    firstName: string;
    lastName: string;
    id: string;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    lastModifiedBy: string;
    mrn: string;
    dateOfBirth: string;
    gender: "Unknown" | "Male" | "Female" | "Other";
    email?: string | undefined;
    medications?: string[] | undefined;
    phone?: string | undefined;
    address?: {
        street?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        zipCode?: string | undefined;
        country?: string | undefined;
    } | undefined;
    emergencyContact?: {
        name: string;
        phone: string;
        relationship: string;
    } | undefined;
    insuranceInfo?: {
        provider: string;
        policyNumber: string;
        groupNumber?: string | undefined;
    } | undefined;
    allergies?: string[] | undefined;
    conditions?: string[] | undefined;
}, {
    firstName: string;
    lastName: string;
    id: string;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    lastModifiedBy: string;
    mrn: string;
    dateOfBirth: string;
    gender: "Unknown" | "Male" | "Female" | "Other";
    email?: string | undefined;
    medications?: string[] | undefined;
    phone?: string | undefined;
    address?: {
        street?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        zipCode?: string | undefined;
        country?: string | undefined;
    } | undefined;
    emergencyContact?: {
        name: string;
        phone: string;
        relationship: string;
    } | undefined;
    insuranceInfo?: {
        provider: string;
        policyNumber: string;
        groupNumber?: string | undefined;
    } | undefined;
    allergies?: string[] | undefined;
    conditions?: string[] | undefined;
}>;
export declare const PatientSearchSchema: z.ZodObject<{
    query: z.ZodString;
    limit: z.ZodDefault<z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, number, string>, z.ZodNumber]>>>;
    nextToken: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    query: string;
    nextToken?: string | undefined;
}, {
    query: string;
    limit?: string | number | undefined;
    nextToken?: string | undefined;
}>;
export declare const CreatePatientSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    mrn: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    dateOfBirth: z.ZodString;
    gender: z.ZodEnum<["Male", "Female", "Other", "Unknown"]>;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodObject<{
        street: z.ZodOptional<z.ZodString>;
        city: z.ZodOptional<z.ZodString>;
        state: z.ZodOptional<z.ZodString>;
        zipCode: z.ZodOptional<z.ZodString>;
        country: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        street?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        zipCode?: string | undefined;
        country?: string | undefined;
    }, {
        street?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        zipCode?: string | undefined;
        country?: string | undefined;
    }>>;
    emergencyContact: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        relationship: z.ZodString;
        phone: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        phone: string;
        relationship: string;
    }, {
        name: string;
        phone: string;
        relationship: string;
    }>>;
    insuranceInfo: z.ZodOptional<z.ZodObject<{
        provider: z.ZodString;
        policyNumber: z.ZodString;
        groupNumber: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        provider: string;
        policyNumber: string;
        groupNumber?: string | undefined;
    }, {
        provider: string;
        policyNumber: string;
        groupNumber?: string | undefined;
    }>>;
    allergies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    medications: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    conditions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    createdBy: z.ZodString;
    lastModifiedBy: z.ZodString;
}, "id" | "createdAt" | "updatedAt" | "createdBy" | "lastModifiedBy">, "strip", z.ZodTypeAny, {
    firstName: string;
    lastName: string;
    mrn: string;
    dateOfBirth: string;
    gender: "Unknown" | "Male" | "Female" | "Other";
    email?: string | undefined;
    medications?: string[] | undefined;
    phone?: string | undefined;
    address?: {
        street?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        zipCode?: string | undefined;
        country?: string | undefined;
    } | undefined;
    emergencyContact?: {
        name: string;
        phone: string;
        relationship: string;
    } | undefined;
    insuranceInfo?: {
        provider: string;
        policyNumber: string;
        groupNumber?: string | undefined;
    } | undefined;
    allergies?: string[] | undefined;
    conditions?: string[] | undefined;
}, {
    firstName: string;
    lastName: string;
    mrn: string;
    dateOfBirth: string;
    gender: "Unknown" | "Male" | "Female" | "Other";
    email?: string | undefined;
    medications?: string[] | undefined;
    phone?: string | undefined;
    address?: {
        street?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        zipCode?: string | undefined;
        country?: string | undefined;
    } | undefined;
    emergencyContact?: {
        name: string;
        phone: string;
        relationship: string;
    } | undefined;
    insuranceInfo?: {
        provider: string;
        policyNumber: string;
        groupNumber?: string | undefined;
    } | undefined;
    allergies?: string[] | undefined;
    conditions?: string[] | undefined;
}>;
export declare const UpdatePatientSchema: z.ZodObject<{
    email: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    medications: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    mrn: z.ZodOptional<z.ZodString>;
    dateOfBirth: z.ZodOptional<z.ZodString>;
    gender: z.ZodOptional<z.ZodEnum<["Male", "Female", "Other", "Unknown"]>>;
    phone: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    address: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        street: z.ZodOptional<z.ZodString>;
        city: z.ZodOptional<z.ZodString>;
        state: z.ZodOptional<z.ZodString>;
        zipCode: z.ZodOptional<z.ZodString>;
        country: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        street?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        zipCode?: string | undefined;
        country?: string | undefined;
    }, {
        street?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        zipCode?: string | undefined;
        country?: string | undefined;
    }>>>;
    emergencyContact: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        relationship: z.ZodString;
        phone: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        phone: string;
        relationship: string;
    }, {
        name: string;
        phone: string;
        relationship: string;
    }>>>;
    insuranceInfo: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        provider: z.ZodString;
        policyNumber: z.ZodString;
        groupNumber: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        provider: string;
        policyNumber: string;
        groupNumber?: string | undefined;
    }, {
        provider: string;
        policyNumber: string;
        groupNumber?: string | undefined;
    }>>>;
    allergies: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    conditions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
}, "strip", z.ZodTypeAny, {
    email?: string | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    medications?: string[] | undefined;
    mrn?: string | undefined;
    dateOfBirth?: string | undefined;
    gender?: "Unknown" | "Male" | "Female" | "Other" | undefined;
    phone?: string | undefined;
    address?: {
        street?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        zipCode?: string | undefined;
        country?: string | undefined;
    } | undefined;
    emergencyContact?: {
        name: string;
        phone: string;
        relationship: string;
    } | undefined;
    insuranceInfo?: {
        provider: string;
        policyNumber: string;
        groupNumber?: string | undefined;
    } | undefined;
    allergies?: string[] | undefined;
    conditions?: string[] | undefined;
}, {
    email?: string | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    medications?: string[] | undefined;
    mrn?: string | undefined;
    dateOfBirth?: string | undefined;
    gender?: "Unknown" | "Male" | "Female" | "Other" | undefined;
    phone?: string | undefined;
    address?: {
        street?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        zipCode?: string | undefined;
        country?: string | undefined;
    } | undefined;
    emergencyContact?: {
        name: string;
        phone: string;
        relationship: string;
    } | undefined;
    insuranceInfo?: {
        provider: string;
        policyNumber: string;
        groupNumber?: string | undefined;
    } | undefined;
    allergies?: string[] | undefined;
    conditions?: string[] | undefined;
}>;
export type Patient = z.infer<typeof PatientSchema>;
export type PatientSearch = z.infer<typeof PatientSearchSchema>;
export type CreatePatientInput = z.infer<typeof CreatePatientSchema>;
export type UpdatePatientInput = z.infer<typeof UpdatePatientSchema>;
export interface PatientEntity extends Patient {
    pk: string;
    sk: string;
    gsi1pk?: string;
    gsi1sk?: string;
    gsi2pk?: string;
    gsi2sk?: string;
    entityType: 'PATIENT';
}
//# sourceMappingURL=patient.d.ts.map