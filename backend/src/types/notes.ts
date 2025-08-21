import { z } from 'zod';

// Note status states from PRP
export enum NoteStatus {
  PROCESSING = 'PROCESSING',
  DRAFT = 'DRAFT', 
  EDITED = 'EDITED',
  SIGNED = 'SIGNED',
  ERROR = 'ERROR',
}

// SOAP note sections schema from PRP
export const SOAPSectionsSchema = z.object({
  chiefComplaint: z.string(),
  subjective: z.object({
    hpi: z.string(),
    ros: z.string(),
    medications: z.array(z.string()),
    allergies: z.array(z.string()),
  }),
  objective: z.object({
    vitals: z.string().default('[See EHR flowsheet]'),
    physicalExam: z.string(),
  }),
  assessment: z.string(),
  plan: z.array(z.string()),
});

// Medical codes schema from PRP
export const MedicalCodesSchema = z.object({
  icd10: z.array(z.object({
    code: z.string(),
    description: z.string(),
    confidence: z.number().min(0).max(1),
  })),
  cpt: z.array(z.object({
    code: z.string(),
    description: z.string(),
  })),
});

// Note metadata schema from PRP
export const NoteMetadataSchema = z.object({
  generatedAt: z.string(),
  lastModified: z.string(),
  modifiedBy: z.string(),
  version: z.number(),
  processingTimeMs: z.number(),
});

// Audit trail schema from PRP
export const AuditTrailSchema = z.object({
  created: z.object({
    userId: z.string(),
    timestamp: z.string(),
  }),
  edits: z.array(z.object({
    userId: z.string(),
    timestamp: z.string(),
    section: z.string(),
  })),
  signed: z.object({
    userId: z.string(),
    timestamp: z.string(),
  }).optional(),
});

// Complete clinical note schema from PRP
export const ClinicalNoteSchema = z.object({
  noteId: z.string(),
  encounterId: z.string(),
  status: z.nativeEnum(NoteStatus),
  sections: SOAPSectionsSchema,
  codes: MedicalCodesSchema,
  metadata: NoteMetadataSchema,
  audit: AuditTrailSchema,
  transcriptId: z.string().optional(),
  transcriptS3Key: z.string().optional(),
});

// Input schema for note generation from PRP
export const GenerateNoteInputSchema = z.object({
  transcriptionId: z.string(),
  transcript: z.string(),
  duration: z.number(),
  metadata: z.object({
    patientId: z.string(),
    providerId: z.string(),
    encounterDate: z.string(),
    clinicId: z.string().optional(),
  }),
});

// Update note schema for editing
export const UpdateNoteSchema = z.object({
  sections: SOAPSectionsSchema.partial().optional(),
  codes: MedicalCodesSchema.partial().optional(),
  status: z.nativeEnum(NoteStatus).optional(),
});

// Types
export type SOAPSections = z.infer<typeof SOAPSectionsSchema>;
export type MedicalCodes = z.infer<typeof MedicalCodesSchema>;
export type NoteMetadata = z.infer<typeof NoteMetadataSchema>;
export type AuditTrail = z.infer<typeof AuditTrailSchema>;
export type ClinicalNote = z.infer<typeof ClinicalNoteSchema>;
export type GenerateNoteInput = z.infer<typeof GenerateNoteInputSchema>;
export type UpdateNoteInput = z.infer<typeof UpdateNoteSchema>;

// DynamoDB Entity for clinical notes
export interface ClinicalNoteEntity extends ClinicalNote {
  pk: string;           // ENCOUNTER#<encounterId>
  sk: string;           // NOTE#<noteId>#VERSION#<version>
  gsi1pk: string;       // NOTE#<noteId>
  gsi1sk: string;       // ENCOUNTER#<encounterId>
  gsi2pk?: string;      // PROVIDER#<providerId>#DATE#<date>
  gsi2sk?: string;      // NOTE#<timestamp>#<noteId>
  entityType: 'CLINICAL_NOTE';
  ttl: number;          // 7 years from creation (HIPAA retention)
}

// Validation rules from PRP
export const ValidationRules = {
  chiefComplaint: { required: true, maxLength: 500 },
  'subjective.hpi': { required: true, maxLength: 5000 },
  'objective.physicalExam': { required: false, maxLength: 5000 },
  assessment: { required: true, maxLength: 2000 },
  plan: { required: true, maxLength: 3000 },
} as const;

// Fallback template from PRP for GPT-4 failure
export const FallbackNoteTemplate: SOAPSections = {
  chiefComplaint: '[Unable to extract - please review transcript]',
  subjective: {
    hpi: '[See transcript]',
    ros: '',
    medications: [],
    allergies: [],
  },
  objective: {
    vitals: '[See EHR flowsheet]',
    physicalExam: '',
  },
  assessment: '[Requires manual entry]',
  plan: ['[Requires manual entry]'],
};