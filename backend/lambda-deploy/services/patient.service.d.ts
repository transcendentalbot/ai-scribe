import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Patient, CreatePatientInput, UpdatePatientInput } from '../types/patient';
export declare class PatientService {
    private dynamodb;
    private tableName;
    constructor(dynamodb: DynamoDBDocumentClient, tableName: string);
    /**
     * Create a new patient record
     */
    createPatient(input: CreatePatientInput, providerId: string): Promise<Patient>;
    /**
     * Get patient by ID
     */
    getPatient(patientId: string): Promise<Patient | null>;
    /**
     * Get patient by MRN
     */
    getPatientByMrn(mrn: string): Promise<Patient | null>;
    /**
     * Search patients by name, MRN, or date of birth
     */
    searchPatients(query: string, limit?: number, nextToken?: string): Promise<{
        patients: Patient[];
        nextToken?: string;
    }>;
    /**
     * Get patients by provider
     */
    getPatientsByProvider(providerId: string, limit?: number, nextToken?: string): Promise<{
        patients: Patient[];
        nextToken?: string;
    }>;
    /**
     * Update patient information
     */
    updatePatient(patientId: string, updates: UpdatePatientInput, providerId: string): Promise<Patient>;
    /**
     * Get multiple patients by IDs
     */
    getPatientsByIds(patientIds: string[]): Promise<Patient[]>;
    /**
     * Convert entity to patient model
     */
    private entityToPatient;
}
//# sourceMappingURL=patient.service.d.ts.map