export enum EncounterStatus {
  SCHEDULED = 'SCHEDULED',
  CHECKED_IN = 'CHECKED_IN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export enum ConsentType {
  RECORDING = 'RECORDING',
  DATA_SHARING = 'DATA_SHARING',
  TREATMENT = 'TREATMENT',
}

export interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: 'Male' | 'Female' | 'Other' | 'Unknown';
  email?: string;
  phone?: string;
}

export interface Encounter {
  id: string;
  patientId: string;
  providerId: string;
  scheduledAt: string;
  startedAt?: string;
  completedAt?: string;
  status: EncounterStatus;
  type: 'INITIAL' | 'FOLLOW_UP' | 'URGENT' | 'ROUTINE' | 'TELEHEALTH';
  chiefComplaint?: string;
  reasonForVisit?: string;
  location?: {
    facilityName: string;
    roomNumber?: string;
    department?: string;
  };
  consents?: {
    type: ConsentType;
    granted: boolean;
    grantedAt: string;
    grantedBy: string;
    notes?: string;
  }[];
  patient?: Patient;
}

export interface Provider {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  licenseNumber?: string;
  specialty?: string;
  organization?: string;
}