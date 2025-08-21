interface TranscriptionSession {
    sessionId: string;
    connectionId: string;
    encounterId: string;
    startTime: number;
    endTime?: number;
    status: 'active' | 'completed';
    provider: 'deepgram' | 'aws-transcribe';
    audioBuffer: Buffer[];
    bufferSize: number;
    lastProcessedTime: number;
}
interface TranscriptionSegment {
    encounterId: string;
    timestamp: number;
    text: string;
    speaker?: string;
    confidence?: number;
    entities?: Array<{
        type: 'medication' | 'symptom' | 'vital' | 'condition';
        text: string;
        value?: string;
        unit?: string;
        attributes?: Record<string, unknown>;
    }>;
    isPartial?: boolean;
}
declare class TranscriptionService {
    transcribeFromS3(params: {
        sessionId: string;
        s3Key: string;
        encounterId: string;
    }): Promise<{
        transcriptCount: number;
        segments: TranscriptionSegment[];
    }>;
    getDeepgramClient(): Promise<any>;
    saveSession(session: TranscriptionSession): Promise<void>;
    getSession(sessionId: string): Promise<TranscriptionSession | null>;
    deleteSession(sessionId: string): Promise<void>;
    startTranscription(params: {
        connectionId: string;
        encounterId: string;
        metadata?: any;
        apiGatewayClient?: any;
    }): Promise<TranscriptionSession>;
    processAudioChunk(params: {
        sessionId: string;
        chunk: string;
        sequenceNumber: number;
    }): Promise<TranscriptionSegment | null>;
    transcribeWithDeepgram(session: TranscriptionSession, audioBuffer: Buffer): Promise<TranscriptionSegment | null>;
    mapSpeakerLabel(speakerId: number): string;
    identifySpeaker(words: any[], transcript: string, session: TranscriptionSession): string;
    extractMedicalEntities(text: string): any[];
    saveTranscriptionSegment(segment: TranscriptionSegment): Promise<void>;
    stopTranscription(params: {
        sessionId: string;
    }): Promise<{
        transcriptCount: number;
        recordingId?: string;
    }>;
    createRecordingFromTranscription(session: TranscriptionSession): Promise<string>;
    getTranscriptionSegments(encounterId: string, limit?: number): Promise<TranscriptionSegment[]>;
    handleTranscriptEvent(session: TranscriptionSession, data: any, isPartial: boolean): Promise<void>;
}
export declare const transcriptionService: TranscriptionService;
export {};
//# sourceMappingURL=transcription.service.d.ts.map