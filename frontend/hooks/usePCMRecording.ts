'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useWebSocket } from './useWebSocket';
import { toast } from 'sonner';

interface UsePCMRecordingProps {
  encounterId: string;
  onRecordingComplete?: (recordingId: string) => void;
  onRecordingStarted?: (data: any) => void;
  onRecordingStopped?: (data: any) => void;
  onMessage?: (message: any) => void;
  onError?: (error: any) => void;
}

export function usePCMRecording({ 
  encounterId, 
  onRecordingComplete,
  onRecordingStarted,
  onRecordingStopped,
  onMessage,
  onError
}: UsePCMRecordingProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [isInitializing, setIsInitializing] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sequenceNumberRef = useRef(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const transcriptionSessionIdRef = useRef<string | null>(null);
  
  const { isConnected, sendMessage, lastMessage } = useWebSocket();

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;
    
    try {
      const message = JSON.parse(lastMessage.data);
      console.log('[PCM Recording] Received:', message.type);
      
      // Call custom message handler
      if (onMessage) {
        onMessage(message);
      }
      
      switch (message.type) {
        case 'recording-started':
          setSessionId(message.sessionId);
          sessionIdRef.current = message.sessionId;
          
          // Store transcription session ID if present
          if (message.transcriptionSessionId) {
            transcriptionSessionIdRef.current = message.transcriptionSessionId;
          }
          
          setIsInitializing(false);
          console.log('[PCM Recording] Session started:', message.sessionId);
          
          // Call custom handler
          if (onRecordingStarted) {
            onRecordingStarted(message);
          }
          break;
          
        case 'recording-stopped':
          // Only process if this message is for our current session
          if (message.sessionId === sessionIdRef.current) {
            console.log('[PCM Recording] Recording stopped:', message);
            setIsRecording(false);
            setSessionId(null);
            sessionIdRef.current = null;
            transcriptionSessionIdRef.current = null;
            
            if (message.recordingId && onRecordingComplete) {
              onRecordingComplete(message.recordingId);
            }
            
            // Call custom handler
            if (onRecordingStopped) {
              onRecordingStopped(message);
            }
          }
          break;
          
        case 'chunk-received':
          // Acknowledge chunk received
          break;
          
        case 'error':
          console.error('[PCM Recording] Error:', message.message);
          toast.error(message.message);
          setIsRecording(false);
          setSessionId(null);
          sessionIdRef.current = null;
          transcriptionSessionIdRef.current = null;
          
          if (onError) {
            onError(message);
          }
          break;
          
        case 'transcript':
          // This will be handled by the custom onMessage handler
          console.log('[PCM Recording] Transcript received');
          break;
          
        default:
          console.log('[PCM Recording] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[PCM Recording] Failed to parse message:', error);
      if (onError) {
        onError(error);
      }
    }
  }, [lastMessage, sendMessage, onRecordingComplete, onRecordingStarted, onRecordingStopped, onMessage, onError]);

  const startRecording = useCallback(async (options?: {
    enableTranscription?: boolean;
    metadata?: any;
  }) => {
    if (!isConnected) {
      toast.error('WebSocket not connected. Please wait and try again.');
      return;
    }

    if (isRecording) {
      console.warn('[PCM Recording] Already recording');
      return;
    }

    console.log('[PCM Recording] Starting recording...');
    setIsInitializing(true);
    sequenceNumberRef.current = 0;
    
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000, // 16kHz for Deepgram
        }
      });
      
      streamRef.current = stream;
      
      // Create AudioContext
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      
      // Load Audio Worklet
      await audioContextRef.current.audioWorklet.addModule('/worklets/audio-processor.js');
      
      // Create source and worklet node
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      workletNodeRef.current = new AudioWorkletNode(audioContextRef.current, 'audio-processor');
      
      // Handle audio data from worklet
      workletNodeRef.current.port.onmessage = (event) => {
        if (event.data.type === 'audio' && sessionIdRef.current) {
          const pcmData = new Int16Array(event.data.data);
          
          // Convert to base64
          const base64 = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(pcmData.buffer))));
          const sequenceNumber = sequenceNumberRef.current++;
          
          // Send to WebSocket
          sendMessage({
            action: 'audio-stream',
            type: 'audio-chunk',
            sessionId: sessionIdRef.current,
            transcriptionSessionId: transcriptionSessionIdRef.current,
            chunk: base64,
            sequenceNumber,
            encoding: 'linear16',
            sampleRate: 16000,
          });
        }
      };
      
      // Connect audio graph
      sourceRef.current.connect(workletNodeRef.current);
      
      // Send start-recording message with PCM metadata
      console.log('[PCM Recording] Sending start-recording message...');
      sendMessage({
        action: 'audio-stream',
        type: 'start-recording',
        encounterId,
        enableTranscription: options?.enableTranscription ?? false,
        metadata: {
          sampleRate: 16000,
          channels: 1,
          encoding: 'linear16',
          format: 'pcm',
          ...options?.metadata,
        },
      });
      
      setIsRecording(true);
      
      // Start duration timer
      setDuration(0);
      const startTime = Date.now();
      durationIntervalRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      
    } catch (error) {
      console.error('[PCM Recording] Failed to start recording:', error);
      toast.error('Failed to access microphone. Please check permissions.');
      setIsInitializing(false);
      if (onError) {
        onError(error);
      }
    }
  }, [isConnected, isRecording, encounterId, sendMessage, onError]);

  const stopRecording = useCallback(async () => {
    if (!sessionIdRef.current) {
      console.warn('[PCM Recording] No active recording to stop');
      return;
    }

    console.log('[PCM Recording] Stopping recording for session:', sessionIdRef.current);

    // Clear duration timer
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    
    // Send stop message
    sendMessage({
      action: 'audio-stream',
      type: 'stop-recording',
      sessionId: sessionIdRef.current,
      transcriptionSessionId: transcriptionSessionIdRef.current,
    });
    
    // Clean up audio
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, [sendMessage]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (isRecording) {
        console.log('[PCM Recording] Cleaning up on unmount');
        stopRecording();
      }
    };
  }, [isRecording, stopRecording]);

  return {
    isRecording,
    sessionId,
    duration,
    isInitializing,
    startRecording,
    stopRecording,
  };
}