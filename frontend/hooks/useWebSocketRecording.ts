'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useWebSocket } from './useWebSocket';
import { toast } from 'sonner';

interface UseWebSocketRecordingProps {
  encounterId: string;
  onRecordingComplete?: (recordingId: string) => void;
}

export function useWebSocketRecording({ 
  encounterId, 
  onRecordingComplete 
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
  const pendingChunksRef = useRef<Array<{ chunk: string; sequenceNumber: number }>>([])
  
  const { isConnected, sendMessage, lastMessage } = useWebSocket();

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;
    
    try {
      const message = JSON.parse(lastMessage.data);
      
      switch (message.type) {
        case 'recording-started':
          setSessionId(message.sessionId);
          sessionIdRef.current = message.sessionId;
          setIsInitializing(false);
          console.log('[WebSocket Recording] Session started:', message.sessionId);
          
          // Send any pending chunks
          if (pendingChunksRef.current.length > 0) {
            console.log('[WebSocket Recording] Sending', pendingChunksRef.current.length, 'pending chunks');
            pendingChunksRef.current.forEach((pending) => {
              sendMessage({
                action: 'audio-stream',
                type: 'audio-chunk',
                sessionId: message.sessionId,
                chunk: pending.chunk,
                sequenceNumber: pending.sequenceNumber,
              });
            });
            pendingChunksRef.current = [];
          }
          break;
          
        case 'recording-stopped':
          console.log('[WebSocket Recording] Recording stopped:', message);
          setIsRecording(false);
          setSessionId(null);
          sessionIdRef.current = null;
          if (message.recordingId && onRecordingComplete) {
            onRecordingComplete(message.recordingId);
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
          break;
      }
    } catch (error) {
      console.error('[WebSocket Recording] Failed to parse message:', error);
    }
  }, [lastMessage, onRecordingComplete]);

  const startRecording = useCallback(async () => {
    if (!isConnected) {
      toast.error('WebSocket not connected');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create MediaRecorder with webm format
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      sequenceNumberRef.current = 0;
      
      // Send start message
      sendMessage({
        action: 'audio-stream',
        type: 'start-recording',
        encounterId,
        metadata: {
          sampleRate: 48000,
          channels: 1,
          codec: 'audio/webm;codecs=opus',
        },
      });
      
      // Handle data available - send chunks to WebSocket
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          // Convert blob to base64 and send
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result?.toString().split(',')[1];
            if (base64) {
              const seqNum = sequenceNumberRef.current++;
              
              if (sessionIdRef.current) {
                console.log('[WebSocket Recording] Sending chunk, size:', event.data.size, 'sessionId:', sessionIdRef.current);
                sendMessage({
                  action: 'audio-stream',
                  type: 'audio-chunk',
                  sessionId: sessionIdRef.current,
                  chunk: base64,
                  sequenceNumber: seqNum,
                });
              } else {
                console.log('[WebSocket Recording] No session ID yet, queuing chunk');
                pendingChunksRef.current.push({ chunk: base64, sequenceNumber: seqNum });
              }
            }
          };
          reader.readAsDataURL(event.data);
          
          // Also keep local copy for backup
          audioChunksRef.current.push(event.data);
        }
      };
      
      // Start recording with 1000ms chunks (1 second) as per spec
      mediaRecorder.start(1000);
      setIsRecording(true);
      setIsInitializing(true);
      
      // Start duration timer
      const startTime = Date.now();
      durationIntervalRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      
    } catch (error) {
      console.error('[WebSocket Recording] Failed to start recording:', error);
      toast.error('Failed to access microphone');
    }
  }, [isConnected, encounterId, sendMessage, sessionId]);

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || !sessionIdRef.current) {
      console.error('[WebSocket Recording] Cannot stop: no recorder or session');
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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording' && sessionIdRef.current) {
      mediaRecorderRef.current.pause();
      
      sendMessage({
        action: 'audio-stream',
        type: 'update-status',
        sessionId: sessionIdRef.current,
        isPaused: true,
      });
    }
  }, [sendMessage]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused' && sessionIdRef.current) {
      mediaRecorderRef.current.resume();
      
      sendMessage({
        action: 'audio-stream',
        type: 'update-status',
        sessionId: sessionIdRef.current,
        isPaused: false,
      });
    }
  }, [sendMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
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
    isConnected,
    isInitializing,
    sessionId,
    duration,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  };
}