import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Encounter, CreateEncounterInput, UpdateEncounterInput, CaptureConsentInput, EncounterStatus, UpdateEncounterStatusInput } from '../types/encounter';
export declare class EncounterService {
    private dynamodb;
    private tableName;
    constructor(dynamodb: DynamoDBDocumentClient, tableName: string);
    /**
     * Create a new encounter
     */
    createEncounter(input: CreateEncounterInput, providerId: string): Promise<Encounter>;
    /**
     * Get encounter by ID
     */
    getEncounter(encounterId: string): Promise<Encounter | null>;
    /**
     * Update encounter information
     */
    updateEncounter(encounterId: string, updates: UpdateEncounterInput, providerId: string): Promise<Encounter>;
    /**
     * Update encounter status with workflow validation
     */
    updateEncounterStatus(encounterId: string, statusUpdate: UpdateEncounterStatusInput, providerId: string): Promise<Encounter>;
    /**
     * Capture patient consent for encounter
     */
    captureConsent(encounterId: string, consent: CaptureConsentInput, patientId: string, providerId: string): Promise<Encounter>;
    /**
     * Get daily encounter list for a provider
     */
    getDailyEncounters(providerId: string, date: string, status?: EncounterStatus, limit?: number, nextToken?: string): Promise<{
        encounters: Encounter[];
        nextToken?: string;
    }>;
    /**
     * Get all encounters for a date (all providers)
     */
    getEncountersByDate(date: string, limit?: number, nextToken?: string): Promise<{
        encounters: Encounter[];
        nextToken?: string;
    }>;
    /**
     * Get patient encounters
     */
    getPatientEncounters(patientId: string, limit?: number, nextToken?: string): Promise<{
        encounters: Encounter[];
        nextToken?: string;
    }>;
    /**
     * Add recording to encounter
     */
    addRecording(encounterId: string, recording: {
        startTime: string;
        endTime: string;
        duration: number;
        s3Key: string;
    }, providerId: string): Promise<Encounter>;
    /**
     * Validate status transitions
     */
    private validateStatusTransition;
    /**
     * Convert entity to encounter model
     */
    private entityToEncounter;
}
//# sourceMappingURL=encounter.service.d.ts.map