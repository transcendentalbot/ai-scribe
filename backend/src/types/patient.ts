import { z } from 'zod';

// Patient schemas
export const PatientSchema = z.object({
  id: z.string().uuid(),
  mrn: z.string().min(1), // Medical Record Number
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.enum(['Male', 'Female', 'Other', 'Unknown']),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  emergencyContact: z.object({
    name: z.string(),
    relationship: z.string(),
    phone: z.string(),
  }).optional(),
  insuranceInfo: z.object({
    provider: z.string(),
    policyNumber: z.string(),
    groupNumber: z.string().optional(),
  }).optional(),
  allergies: z.array(z.string()).optional(),
  medications: z.array(z.string()).optional(),
  conditions: z.array(z.string()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(), // Provider ID who created the record
  lastModifiedBy: z.string(), // Provider ID who last modified
});

export const PatientSearchSchema = z.object({
  query: z.string().min(2), // Search by name, MRN, DOB
  limit: z.union([z.string().regex(/^\d+$/).transform(Number), z.number()]).optional().default(20),
  nextToken: z.string().optional(),
});

export const CreatePatientSchema = PatientSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  lastModifiedBy: true,
});

export const UpdatePatientSchema = CreatePatientSchema.partial();

// Types
export type Patient = z.infer<typeof PatientSchema>;
export type PatientSearch = z.infer<typeof PatientSearchSchema>;
export type CreatePatientInput = z.infer<typeof CreatePatientSchema>;
export type UpdatePatientInput = z.infer<typeof UpdatePatientSchema>;

// DynamoDB Patient entity
export interface PatientEntity extends Patient {
  pk: string; // PATIENT#<patientId>
  sk: string; // PROFILE
  gsi1pk?: string; // MRN#<mrn>
  gsi1sk?: string; // PATIENT#<patientId>
  gsi2pk?: string; // PROVIDER#<providerId>
  gsi2sk?: string; // PATIENT#<patientId>#<timestamp>
  entityType: 'PATIENT';
}