import { useState, useRef, useCallback, useEffect } from 'react';
import { useWebSocket } from './useWebSocket';
import { toast } from 'sonner';

interface UseAudioRecordingOptions {
  encounterId: string;
  sampleRate?: number;
  onRecordingStart?: () => void;
  onRecordingStop?: (recordingId: string) => void;
  onError?: (error: Error) => void;
}

interface AudioQuality {
  volume: number;
  noiseLevel: number;
  isClipping: boolean;
}

export const useAudioRecording = ({
  encounterId,
  sampleRate = 16000,
  onRecordingStart,
  onRecordingStop,
  onError,
}: UseAudioRecordingOptions) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioQuality, setAudioQuality] = useState<AudioQuality>({
    volume: 0,
    noiseLevel: 0,
    isClipping: false,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const sequenceNumberRef = useRef(0);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { sendMessage, isConnected, lastMessage } = useWebSocket();

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    const message = JSON.parse(lastMessage.data);
    console.log('[WebSocket] Received message:', message.type, message);
    
    switch (message.type) {
      case 'recording-started':
        sessionIdRef.current = message.sessionId;
        console.log('[WebSocket] Recording started with sessionId:', message.sessionId);
        onRecordingStart?.();
        break;
      
      case 'recording-stopped':
        console.log('[WebSocket] Recording stopped successfully:', {
          recordingId: message.recordingId,
          duration: message.duration,
          s3Key: message.s3Key
        });
        // Clear the session ID after successful stop
        sessionIdRef.current = null;
        onRecordingStop?.(message.recordingId);
        break;
      
      case 'chunk-received':
        console.log('[WebSocket] Chunk acknowledged:', message.sequenceNumber);
        break;
      
      case 'error':
        console.error('[WebSocket] Recording error:', message.message);
        toast.error(message.message || 'Recording error occurred');
        stopRecording();
        break;
        
      default:
        console.log('[WebSocket] Unknown message type:', message.type);
    }
  }, [lastMessage, onRecordingStart, onRecordingStop]);

  // Audio quality monitoring
  const monitorAudioQuality = useCallback(() => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const checkAudio = () => {
      if (!isRecording) return;

      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      const sum = dataArray.reduce((a, b) => a + b, 0);
      const average = sum / dataArray.length;
      const volume = Math.min(100, (average / 128) * 100);
      
      // Simple noise detection (low frequencies)
      const noiseFreqs = dataArray.slice(0, 10);
      const noiseSum = noiseFreqs.reduce((a, b) => a + b, 0);
      const noiseLevel = Math.min(100, (noiseSum / noiseFreqs.length / 128) * 100);
      
      // Clipping detection
      const maxValue = Math.max(...dataArray);
      const isClipping = maxValue > 250;
      
      setAudioQuality({
        volume,
        noiseLevel,
        isClipping,
      });
      
      requestAnimationFrame(checkAudio);
    };
    
    checkAudio();
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    if (!isConnected) {
      toast.error('WebSocket not connected');
      return;
    }

    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate,
          channelCount: 1,
        },
      });
      
      streamRef.current = stream;

      // Set up audio context for monitoring
      audioContextRef.current = new AudioContext({ sampleRate });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Set up MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });

      mediaRecorderRef.current = mediaRecorder;
      sequenceNumberRef.current = 0;

      // Handle data available
      mediaRecorder.ondataavailable = async (event) => {
        console.log('[Audio] Data available:', event.data.size, 'bytes');
        if (event.data.size > 0 && sessionIdRef.current) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result?.toString().split(',')[1];
            if (base64 && sessionIdRef.current) {
              console.log('[Audio] Sending chunk', sequenceNumberRef.current, 'for session:', sessionIdRef.current);
              sendMessage({
                action: 'audio-stream',
                type: 'audio-chunk',
                sessionId: sessionIdRef.current!,
                chunk: base64,
                sequenceNumber: sequenceNumberRef.current++,
              });
            }
          };
          reader.readAsDataURL(event.data);
        }
      };

      // Handle recording stop event
      mediaRecorder.onstop = () => {
        console.log('[Audio] MediaRecorder stopped event fired');
      };

      // Send start recording message
      sendMessage({
        action: 'audio-stream',
        type: 'start-recording',
        encounterId,
        metadata: {
          sampleRate,
          channels: 1,
          codec: mimeType,
        },
      });

      // Start recording with 1-second chunks
      mediaRecorder.start(1000);
      setIsRecording(true);
      startTimeRef.current = Date.now();

      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      // Start audio monitoring
      monitorAudioQuality();

      // Auto-stop after 30 minutes
      setTimeout(() => {
        if (isRecording) {
          toast.warning('Recording auto-stopped after 30 minutes');
          stopRecording();
        }
      }, 30 * 60 * 1000);

    } catch (error) {
      console.error('Failed to start recording:', error);
      const err = error as Error;
      toast.error(err.message || 'Failed to start recording');
      onError?.(err);
    }
  }, [encounterId, isConnected, isPaused, isRecording, monitorAudioQuality, onError, sampleRate, sendMessage]);

  const stopRecording = useCallback(() => {
    console.log('[Audio] Stopping recording...');
    console.log('[Audio] Current sessionId:', sessionIdRef.current);
    console.log('[Audio] MediaRecorder state:', mediaRecorderRef.current?.state);
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      console.log('[Audio] Stopping MediaRecorder');
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      console.log('[Audio] Stopping media stream tracks');
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      console.log('[Audio] Closing audio context');
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }

    if (sessionIdRef.current) {
      console.log('[Audio] Sending stop-recording message for session:', sessionIdRef.current);
      sendMessage({
        action: 'audio-stream',
        type: 'stop-recording',
        sessionId: sessionIdRef.current,
      });
    } else {
      console.warn('[Audio] No sessionId available when stopping recording');
    }

    setIsRecording(false);
    setIsPaused(false);
    setDuration(0);
    // Don't clear sessionId immediately - wait for the response
    // sessionIdRef.current = null;
  }, [sendMessage]);

  const pauseRecording = useCallback(() => {
    if (!isRecording || !sessionIdRef.current) return;

    setIsPaused(true);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
    }

    sendMessage({
      action: 'audio-stream',
      type: 'pause-recording',
      sessionId: sessionIdRef.current,
    });
  }, [isRecording, sendMessage]);

  const resumeRecording = useCallback(() => {
    if (!isRecording || !sessionIdRef.current) return;

    setIsPaused(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
    }

    sendMessage({
      action: 'audio-stream',
      type: 'resume-recording',
      sessionId: sessionIdRef.current,
    });
  }, [isRecording, sendMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isRecording) {
        stopRecording();
      }
    };
  }, [isRecording, stopRecording]);

  return {
    isRecording,
    isPaused,
    duration,
    audioQuality,
    isConnected,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  };
};