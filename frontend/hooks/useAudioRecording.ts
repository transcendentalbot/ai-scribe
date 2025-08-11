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
  
  // Debug logging utility - only logs in development
  const debugLog = (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Audio] ${message}`, ...args);
    }
  };

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    const message = JSON.parse(lastMessage.data);
    // Only log errors in production
    if (message.type === 'error') {
      console.error('[WebSocket] Error:', message);
    } else {
      debugLog('WebSocket message received:', message.type);
    }
    
    switch (message.type) {
      case 'recording-started':
        // Ignore duplicate recording-started messages for the same session
        if (sessionIdRef.current === message.sessionId) {
          debugLog('Ignoring duplicate recording-started for session:', message.sessionId);
          return;
        }
        sessionIdRef.current = message.sessionId;
        debugLog('Recording started with sessionId:', message.sessionId);
        onRecordingStart?.();
        break;
      
      case 'recording-stopped':
        debugLog('Recording stopped successfully:', {
          recordingId: message.recordingId,
          duration: message.duration,
          s3Key: message.s3Key
        });
        // Clear the session ID after successful stop
        sessionIdRef.current = null;
        // Reset recording state after server confirms stop
        setIsRecording(false);
        setIsPaused(false);
        setDuration(0);
        onRecordingStop?.(message.recordingId);
        break;
      
      case 'chunk-received':
        // Don't log every chunk acknowledgment to reduce console noise
        break;
      
      case 'error':
        console.error('[WebSocket] Recording error:', message.message);
        toast.error(message.message || 'Recording error occurred');
        stopRecording();
        break;
        
      default:
        debugLog('Unknown message type:', message.type);
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
    // Prevent multiple simultaneous recording starts
    if (isRecording || sessionIdRef.current) {
      debugLog('Recording already in progress, ignoring start request');
      toast.warning('Recording already in progress');
      return;
    }

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
        if (event.data.size > 0 && sessionIdRef.current) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result?.toString().split(',')[1];
            if (base64 && sessionIdRef.current) {
              // Only log every 10th chunk in development
              if (sequenceNumberRef.current % 10 === 0) {
                debugLog('Sending chunk', sequenceNumberRef.current, 'size:', event.data.size, 'bytes');
              }
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
        debugLog('MediaRecorder stopped event fired');
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

      // Set recording state immediately to prevent duplicate starts
      setIsRecording(true);

      // Start recording with 5-second chunks to reduce frequency and console noise
      mediaRecorder.start(5000);
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
      debugLog('Failed to start recording:', error);
      console.error('Failed to start recording:', error);
      const err = error as Error;
      toast.error(err.message || 'Failed to start recording');
      onError?.(err);
    }
  }, [encounterId, isConnected, isPaused, isRecording, monitorAudioQuality, onError, sampleRate, sendMessage]);

  const stopRecording = useCallback(() => {
    debugLog('Stopping recording...', {
      sessionId: sessionIdRef.current,
      mediaRecorderState: mediaRecorderRef.current?.state
    });
    
    // Always clean up local resources
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      debugLog('Stopping MediaRecorder');
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    if (streamRef.current) {
      debugLog('Stopping media stream tracks');
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      debugLog('Closing audio context');
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Clear the sequence number for next recording
    sequenceNumberRef.current = 0;

    if (sessionIdRef.current && isConnected) {
      debugLog('Sending stop-recording message for session:', sessionIdRef.current);
      const currentSessionId = sessionIdRef.current;
      sendMessage({
        action: 'audio-stream',
        type: 'stop-recording',
        sessionId: currentSessionId,
      });
      // Don't reset state here - wait for server confirmation
      // But set a timeout to force cleanup if no response
      setTimeout(() => {
        if (sessionIdRef.current === currentSessionId) {
          debugLog('No server response after 3 seconds, forcing cleanup');
          sessionIdRef.current = null;
          setIsRecording(false);
          setIsPaused(false);
          setDuration(0);
          onRecordingStop?.('timeout');
        }
      }, 3000);
    } else {
      debugLog('No sessionId or not connected - cleaning up immediately');
      // Reset everything immediately
      sessionIdRef.current = null;
      setIsRecording(false);
      setIsPaused(false);
      setDuration(0);
      // Call the callback to update parent component
      if (!sessionIdRef.current) {
        onRecordingStop?.('no-session');
      }
    }
  }, [sendMessage, isConnected, onRecordingStop]);

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

  // Cleanup on unmount or WebSocket disconnect
  useEffect(() => {
    return () => {
      if (isRecording) {
        stopRecording();
      }
    };
  }, [isRecording, stopRecording]);

  // Handle WebSocket disconnection during recording
  useEffect(() => {
    if (!isConnected && isRecording && sessionIdRef.current) {
      // stopRecording will handle cleanup properly when disconnected
      stopRecording();
    }
  }, [isConnected, isRecording, stopRecording]);

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