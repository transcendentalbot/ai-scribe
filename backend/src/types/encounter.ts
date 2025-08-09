import { z } from 'zod';

// Encounter status workflow
export enum EncounterStatus {
  SCHEDULED = 'SCHEDULED',
  CHECKED_IN = 'CHECKED_IN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

// Consent types
export enum ConsentType {
  RECORDING = 'RECORDING',
  DATA_SHARING = 'DATA_SHARING',
  TREATMENT = 'TREATMENT',
}

// Encounter schemas
export const EncounterSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  providerId: z.string().uuid(),
  organizationId: z.string().optional(),
  scheduledAt: z.string(), // ISO datetime
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  status: z.nativeEnum(EncounterStatus),
  type: z.enum(['INITIAL', 'FOLLOW_UP', 'URGENT', 'ROUTINE', 'TELEHEALTH']),
  chiefComplaint: z.string().optional(),
  reasonForVisit: z.string().optional(),
  location: z.object({
    facilityName: z.string(),
    roomNumber: z.string().optional(),
    department: z.string().optional(),
  }).optional(),
  vitals: z.object({
    bloodPressure: z.string().optional(),
    heartRate: z.number().optional(),
    temperature: z.number().optional(),
    weight: z.number().optional(),
    height: z.number().optional(),
    respiratoryRate: z.number().optional(),
    oxygenSaturation: z.number().optional(),
  }).optional(),
  consents: z.array(z.object({
    type: z.nativeEnum(ConsentType),
    granted: z.boolean(),
    grantedAt: z.string(),
    grantedBy: z.string(), // Patient or guardian ID
    expiresAt: z.string().optional(),
    notes: z.string().optional(),
  })).optional(),
  recordings: z.array(z.object({
    id: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    duration: z.number(),
    s3Key: z.string(),
    transcriptionId: z.string().optional(),
  })).optional(),
  notes: z.string().optional(),
  diagnoses: z.array(z.object({
    code: z.string(),
    description: z.string(),
    type: z.enum(['PRIMARY', 'SECONDARY']),
  })).optional(),
  procedures: z.array(z.object({
    code: z.string(),
    description: z.string(),
    performedAt: z.string(),
  })).optional(),
  medications: z.array(z.object({
    name: z.string(),
    dosage: z.string(),
    frequency: z.string(),
    startDate: z.string(),
    endDate: z.string().optional(),
  })).optional(),
  followUpInstructions: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
  lastModifiedBy: z.string(),
});

export const CreateEncounterSchema = z.object({
  patientId: z.string().uuid(),
  scheduledAt: z.string(),
  type: z.enum(['INITIAL', 'FOLLOW_UP', 'URGENT', 'ROUTINE', 'TELEHEALTH']),
  chiefComplaint: z.string().optional(),
  reasonForVisit: z.string().optional(),
  location: z.object({
    facilityName: z.string(),
    roomNumber: z.string().optional(),
    department: z.string().optional(),
  }).optional(),
});

export const UpdateEncounterSchema = CreateEncounterSchema.partial().extend({
  status: z.nativeEnum(EncounterStatus).optional(),
  vitals: EncounterSchema.shape.vitals.optional(),
  notes: z.string().optional(),
  diagnoses: EncounterSchema.shape.diagnoses.optional(),
  procedures: EncounterSchema.shape.procedures.optional(),
  medications: EncounterSchema.shape.medications.optional(),
  followUpInstructions: z.string().optional(),
  consents: EncounterSchema.shape.consents.optional(),
  recordings: EncounterSchema.shape.recordings.optional(),
});

export const CaptureConsentSchema = z.object({
  type: z.nativeEnum(ConsentType),
  granted: z.boolean(),
  notes: z.string().optional(),
  expiresAt: z.string().optional(),
});

export const DailyEncounterListSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // Defaults to today
  providerId: z.string().uuid().optional(), // If not provided, uses current user
  status: z.nativeEnum(EncounterStatus).optional(),
  limit: z.union([z.string().regex(/^\d+$/).transform(Number), z.number()]).optional().default(50),
  nextToken: z.string().optional(),
});

export const UpdateEncounterStatusSchema = z.object({
  status: z.nativeEnum(EncounterStatus),
  notes: z.string().optional(),
});

// Types
export type Encounter = z.infer<typeof EncounterSchema>;
export type CreateEncounterInput = z.infer<typeof CreateEncounterSchema>;
export type UpdateEncounterInput = z.infer<typeof UpdateEncounterSchema>;
export type CaptureConsentInput = z.infer<typeof CaptureConsentSchema>;
export type DailyEncounterListInput = z.infer<typeof DailyEncounterListSchema>;
export type UpdateEncounterStatusInput = z.infer<typeof UpdateEncounterStatusSchema>;

// DynamoDB Encounter entity
export interface EncounterEntity extends Encounter {
  pk: string; // ENCOUNTER#<encounterId>
  sk: string; // METADATA
  gsi1pk?: string; // PATIENT#<patientId>
  gsi1sk?: string; // ENCOUNTER#<timestamp>#<encounterId>
  gsi2pk?: string; // PROVIDER#<providerId>#DATE#<date>
  gsi2sk?: string; // ENCOUNTER#<timestamp>#<encounterId>
  gsi3pk?: string; // DATE#<date>
  gsi3sk?: string; // ENCOUNTER#<timestamp>#<encounterId>
  entityType: 'ENCOUNTER';
}