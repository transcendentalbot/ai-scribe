'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useWebSocket } from './useWebSocket';
import { toast } from 'sonner';

interface UseWebSocketRecordingProps {
  encounterId: string;
  onRecordingComplete?: (recordingId: string) => void;
  onRecordingStarted?: (data: any) => void;
  onRecordingStopped?: (data: any) => void;
  onMessage?: (message: any) => void;
  onError?: (error: any) => void;
}

export function useWebSocketRecording({ 
  encounterId, 
  onRecordingComplete,
  onRecordingStarted,
  onRecordingStopped,
  onMessage,
  onError
}: UseWebSocketRecordingProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [isInitializing, setIsInitializing] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const sequenceNumberRef = useRef(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const pendingChunksRef = useRef<Array<{ chunk: string; sequenceNumber: number }>>([]);
  const transcriptionSessionIdRef = useRef<string | null>(null);
  
  const { isConnected, sendMessage, lastMessage } = useWebSocket();

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;
    
    try {
      const message = JSON.parse(lastMessage.data);
      console.log('[WebSocket Recording] Received:', message.type);
      
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
          console.log('[WebSocket Recording] Session started:', message.sessionId);
          
          // Call custom handler
          if (onRecordingStarted) {
            onRecordingStarted(message);
          }
          
          // Send any pending chunks
          if (pendingChunksRef.current.length > 0) {
            console.log('[WebSocket Recording] Sending', pendingChunksRef.current.length, 'pending chunks');
            pendingChunksRef.current.forEach((pending) => {
              sendMessage({
                action: 'audio-stream',
                type: 'audio-chunk',
                sessionId: message.sessionId,
                transcriptionSessionId: transcriptionSessionIdRef.current,
                chunk: pending.chunk,
                sequenceNumber: pending.sequenceNumber,
              });
            });
            pendingChunksRef.current = [];
          }
          break;
          
        case 'recording-stopped':
          // Only process if this message is for our current session
          if (message.sessionId === sessionIdRef.current) {
            console.log('[WebSocket Recording] Recording stopped:', message);
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
          
        case 'recording-auto-stopped':
          // Only process if this message is for our current session
          if (message.sessionId === sessionIdRef.current) {
            console.warn('[WebSocket Recording] Recording auto-stopped:', message);
            setIsRecording(false);
            setSessionId(null);
            sessionIdRef.current = null;
            transcriptionSessionIdRef.current = null;
            
            // Stop media recorder
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
              mediaRecorderRef.current.stop();
            }
            
            // Show notification to user
            toast.warning(`Recording automatically stopped after ${Math.floor(message.duration / 60)} minutes to prevent excessive charges.`);
            
            // Call handlers
            if (onRecordingStopped) {
              onRecordingStopped(message);
            }
          }
          break;
          
        case 'chunk-received':
          console.log('[WebSocket Recording] Chunk acknowledged:', message.sequenceNumber);
          break;
          
        case 'error':
          console.error('[WebSocket Recording] Error:', message.message);
          toast.error(message.message);
          setIsRecording(false);
          setSessionId(null);
          sessionIdRef.current = null;
          transcriptionSessionIdRef.current = null;
          
          if (onError) {
            onError(message);
          }
          break;
          
        case 'transcript-segment':
          // This will be handled by the custom onMessage handler
          console.log('[WebSocket Recording] Transcript segment received');
          break;
          
        default:
          console.log('[WebSocket Recording] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[WebSocket Recording] Failed to parse message:', error);
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
      console.warn('[WebSocket Recording] Already recording');
      return;
    }

    console.log('[WebSocket Recording] Starting recording...');
    setIsInitializing(true);
    audioChunksRef.current = [];
    sequenceNumberRef.current = 0;
    
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000, // Optimal for transcription
        }
      });
      
      // Detect best audio format for browser compatibility
      const getBestAudioFormat = () => {
        // Safari detection
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        
        // For Safari, try mp4 first
        if (isSafari) {
          console.log('[WebSocket Recording] Detected Safari browser');
          if (MediaRecorder.isTypeSupported('audio/mp4')) {
            console.log('[WebSocket Recording] Using audio/mp4 for Safari');
            return 'audio/mp4';
          }
          // Safari might support webm in newer versions
          if (MediaRecorder.isTypeSupported('audio/webm')) {
            console.log('[WebSocket Recording] Using audio/webm for Safari');
            return 'audio/webm';
          }
        }
        
        // Try audio/ogg first - it has better metadata support
        if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          console.log('[WebSocket Recording] Using audio/ogg;codecs=opus for better metadata support');
          return 'audio/ogg;codecs=opus';
        }
        
        // For Chrome/Edge, prefer webm with opus codec
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          console.log('[WebSocket Recording] Using audio/webm;codecs=opus');
          return 'audio/webm;codecs=opus';
        }
        
        // Fallback to basic webm
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          console.log('[WebSocket Recording] Using audio/webm (no codec specified)');
          return 'audio/webm';
        }
        
        // Last resort - try ogg without codec specification
        if (MediaRecorder.isTypeSupported('audio/ogg')) {
          console.log('[WebSocket Recording] Using audio/ogg (no codec specified)');
          return 'audio/ogg';
        }
        
        // Final fallback
        console.error('[WebSocket Recording] No supported audio format found');
        return '';
      };

      const mimeType = getBestAudioFormat();
      
      if (!mimeType) {
        toast.error('Your browser does not support audio recording');
        setIsInitializing(false);
        return;
      }
      
      console.log('[WebSocket Recording] Using audio format:', mimeType);
        
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 16000, // Lower bitrate for transcription
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      // Send start-recording message with transcription options
      console.log('[WebSocket Recording] Sending start-recording message...');
      sendMessage({
        action: 'audio-stream',
        type: 'start-recording',
        encounterId,
        enableTranscription: options?.enableTranscription ?? false,
        metadata: {
          sampleRate: 16000,
          channels: 1,
          codec: mimeType,
          ...options?.metadata,
        },
      });
      
      // Set up audio chunk handler
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          
          // Convert to base64 and send via WebSocket
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result?.toString().split(',')[1];
            if (base64) {
              const currentSessionId = sessionIdRef.current;
              const currentTranscriptionId = transcriptionSessionIdRef.current;
              const sequenceNumber = sequenceNumberRef.current++;
              
              if (currentSessionId) {
                // Session is ready, send immediately
                sendMessage({
                  action: 'audio-stream',
                  type: 'audio-chunk',
                  sessionId: currentSessionId,
                  transcriptionSessionId: currentTranscriptionId,
                  chunk: base64,
                  sequenceNumber,
                });
              } else {
                // Session not ready yet, queue the chunk
                console.log('[WebSocket Recording] Queueing chunk', sequenceNumber, '(session not ready)');
                pendingChunksRef.current.push({ chunk: base64, sequenceNumber });
              }
            }
          };
          reader.readAsDataURL(event.data);
        }
      };
      
      // Start recording immediately
      console.log('[WebSocket Recording] Starting MediaRecorder...');
      mediaRecorder.start(100); // 100ms chunks for low latency
      setIsRecording(true);
      
      // Start duration timer
      setDuration(0);
      const startTime = Date.now();
      durationIntervalRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      
    } catch (error) {
      console.error('[WebSocket Recording] Failed to start recording:', error);
      toast.error('Failed to access microphone. Please check permissions.');
      setIsInitializing(false);
      if (onError) {
        onError(error);
      }
    }
  }, [isConnected, isRecording, encounterId, sendMessage, onError]);

  const stopRecording = useCallback(async (options?: {
    transcriptionSessionId?: string;
  }) => {
    if (!mediaRecorderRef.current || !sessionIdRef.current) {
      console.warn('[WebSocket Recording] No active recording to stop');
      return;
    }

    console.log('[WebSocket Recording] Stopping recording for session:', sessionIdRef.current);

    // Clear duration timer
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    
    // Send stop message BEFORE stopping MediaRecorder
    sendMessage({
      action: 'audio-stream',
      type: 'stop-recording',
      sessionId: sessionIdRef.current,
      transcriptionSessionId: options?.transcriptionSessionId || transcriptionSessionIdRef.current,
    });
    
    // Stop the media recorder after sending stop message
    setTimeout(() => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        mediaRecorderRef.current = null;
      }
    }, 100); // Small delay to ensure stop message is sent first
  }, [sendMessage]);

  const pauseRecording = useCallback(() => {
    if (!mediaRecorderRef.current || !sessionIdRef.current || mediaRecorderRef.current.state !== 'recording') {
      console.warn('[WebSocket Recording] No active recording to pause');
      return;
    }

    mediaRecorderRef.current.pause();
    sendMessage({
      action: 'audio-stream',
      type: 'pause-recording',
      sessionId: sessionIdRef.current,
    });
  }, [sendMessage]);

  const resumeRecording = useCallback(() => {
    if (!mediaRecorderRef.current || !sessionIdRef.current || mediaRecorderRef.current.state !== 'paused') {
      console.warn('[WebSocket Recording] No paused recording to resume');
      return;
    }

    mediaRecorderRef.current.resume();
    sendMessage({
      action: 'audio-stream',
      type: 'resume-recording',
      sessionId: sessionIdRef.current,
    });
  }, [sendMessage]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        console.log('[WebSocket Recording] Cleaning up active recording on unmount');
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  return {
    isRecording,
    sessionId,
    duration,
    isInitializing,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  };
}