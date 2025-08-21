export interface AudioStreamMessage {
    action: 'start-recording' | 'stop-recording' | 'pause-recording' | 'resume-recording' | 'audio-chunk';
    sessionId?: string;
    encounterId?: string;
    chunk?: string;
    sequenceNumber?: number;
    metadata?: {
        sampleRate?: number;
        channels?: number;
        codec?: string;
    };
}
export interface AudioStreamResponse {
    type: 'recording-started' | 'recording-stopped' | 'recording-paused' | 'recording-resumed' | 'chunk-received' | 'error';
    sessionId?: string;
    recordingId?: string;
    uploadUrl?: string;
    sequenceNumber?: number;
    duration?: number;
    s3Key?: string;
    message?: string;
}
export interface RecordingMetadata {
    id: string;
    encounterId: string;
    startTime: string;
    endTime?: string;
    duration?: number;
    s3Key: string;
    transcriptionId?: string;
    status: 'recording' | 'processing' | 'completed' | 'failed';
}
//# sourceMappingURL=audio.d.ts.map