import { api } from './api';

// Types for frontend notes
export interface SOAPSections {
  chiefComplaint: string;
  subjective: {
    hpi: string;
    ros: string;
    medications: string[];
    allergies: string[];
  };
  objective: {
    vitals: string;
    physicalExam: string;
  };
  assessment: string;
  plan: string[];
}

export interface MedicalCodes {
  icd10: Array<{
    code: string;
    description: string;
    confidence: number;
  }>;
  cpt: Array<{
    code: string;
    description: string;
  }>;
}

export interface ClinicalNote {
  noteId: string;
  encounterId: string;
  status: 'PROCESSING' | 'DRAFT' | 'EDITED' | 'SIGNED' | 'ERROR';
  sections: SOAPSections;
  codes: MedicalCodes;
  metadata: {
    generatedAt: string;
    lastModified: string;
    modifiedBy: string;
    version: number;
    processingTimeMs: number;
  };
  audit: {
    created: {
      userId: string;
      timestamp: string;
    };
    edits: Array<{
      userId: string;
      timestamp: string;
      section: string;
    }>;
    signed?: {
      userId: string;
      timestamp: string;
    };
  };
}

export interface UpdateNoteRequest {
  sections?: Partial<SOAPSections>;
  codes?: Partial<MedicalCodes>;
  status?: ClinicalNote['status'];
}

/**
 * Get clinical note by ID
 */
export async function getNote(noteId: string): Promise<ClinicalNote> {
  const response = await api.get(`/notes/${noteId}`);
  return response.data.note;
}

/**
 * Get notes for an encounter
 */
export async function getEncounterNotes(encounterId: string): Promise<ClinicalNote[]> {
  const response = await api.get(`/encounters/${encounterId}/notes`);
  return response.data.notes;
}

/**
 * Update note sections (auto-save functionality)
 */
export async function updateNote(noteId: string, updates: UpdateNoteRequest): Promise<ClinicalNote> {
  const response = await api.patch(`/notes/${noteId}`, updates);
  return response.data.note;
}

/**
 * Sign and lock note
 */
export async function signNote(noteId: string): Promise<ClinicalNote> {
  const response = await api.post(`/notes/${noteId}/sign`);
  return response.data.note;
}

/**
 * Get note version history
 */
export async function getNoteHistory(noteId: string): Promise<ClinicalNote[]> {
  const response = await api.get(`/notes/${noteId}/history`);
  return response.data.versions;
}

/**
 * Generate note from transcripts (manual trigger)
 */
export async function generateNote(encounterId: string): Promise<{ noteId: string; status: string }> {
  const response = await api.post(`/encounters/${encounterId}/generate-note`);
  return response.data;
}

/**
 * Add/remove ICD-10 code
 */
export async function updateICD10Codes(
  noteId: string, 
  codes: Array<{ code: string; description: string; confidence: number }>
): Promise<ClinicalNote> {
  const response = await api.patch(`/notes/${noteId}/codes/icd10`, { codes });
  return response.data.note;
}

/**
 * Update CPT codes
 */
export async function updateCPTCodes(
  noteId: string, 
  codes: Array<{ code: string; description: string }>
): Promise<ClinicalNote> {
  const response = await api.patch(`/notes/${noteId}/codes/cpt`, { codes });
  return response.data.note;
}

/**
 * Validation rules from PRP
 */
export const VALIDATION_RULES = {
  chiefComplaint: { required: true, maxLength: 500 },
  'subjective.hpi': { required: true, maxLength: 5000 },
  'objective.physicalExam': { required: false, maxLength: 5000 },
  assessment: { required: true, maxLength: 2000 },
  plan: { required: true, maxLength: 3000 },
} as const;

/**
 * Validate note section
 */
export function validateSection(section: string, content: string): string[] {
  const errors: string[] = [];
  const rule = VALIDATION_RULES[section as keyof typeof VALIDATION_RULES];
  
  if (!rule) return errors;
  
  if (rule.required && (!content || content.trim().length === 0)) {
    errors.push(`${section} is required`);
  }
  
  if (content && content.length > rule.maxLength) {
    errors.push(`${section} must be less than ${rule.maxLength} characters`);
  }
  
  return errors;
}

/**
 * Get character count for section
 */
export function getCharacterCount(content: string): number {
  return content ? content.length : 0;
}

/**
 * Check if note has unsaved changes
 */
export function hasUnsavedChanges(
  original: SOAPSections, 
  current: SOAPSections
): boolean {
  return JSON.stringify(original) !== JSON.stringify(current);
}