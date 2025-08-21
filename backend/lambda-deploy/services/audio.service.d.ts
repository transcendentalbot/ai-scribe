declare class AudioService {
    private readonly bucketName;
    private readonly tableName;
    private readonly connectionsTable;
    private readonly MIN_PART_SIZE;
    private sessionBuffers;
    private storeSession;
    private getSession;
    private updateSession;
    private deleteSession;
    startRecording({ connectionId, encounterId, metadata, }: {
        connectionId: string;
        encounterId: string;
        metadata?: any;
    }): Promise<{
        sessionId: string;
        uploadUrl: string;
        s3Key: string;
    }>;
    processAudioChunk({ connectionId, sessionId, chunk, sequenceNumber, }: {
        connectionId: string;
        sessionId: string;
        chunk: string;
        sequenceNumber: number;
    }): Promise<{
        status: string;
        sequenceNumber?: undefined;
    } | {
        status: string;
        sequenceNumber: number;
    }>;
    stopRecording({ connectionId, sessionId, }: {
        connectionId: string;
        sessionId: string;
    }): Promise<{
        recordingId: string;
        duration: number;
        s3Key: string;
        encounterId: string;
    }>;
    updateRecordingStatus({ connectionId, sessionId, isPaused, }: {
        connectionId: string;
        sessionId: string;
        isPaused: boolean;
    }): Promise<{
        status: string;
    }>;
}
export declare const audioService: AudioService;
export {};
//# sourceMappingURL=audio.service.d.ts.map