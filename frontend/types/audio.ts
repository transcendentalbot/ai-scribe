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

export interface AudioQuality {
  volume: number;
  noiseLevel: number;
  isClipping: boolean;
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioQuality: AudioQuality;
  sessionId?: string;
}