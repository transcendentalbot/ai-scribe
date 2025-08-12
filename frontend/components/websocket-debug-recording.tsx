'use client';

import { useState, useRef, useEffect } from 'react';
import { Wifi, WifiOff, Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWebSocket } from '@/hooks/useWebSocket';
import { toast } from 'sonner';

interface WebSocketDebugRecordingProps {
  encounterId: string;
}

export function WebSocketDebugRecording({ encounterId }: WebSocketDebugRecordingProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [audioChunkCount, setAudioChunkCount] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const pendingChunksRef = useRef<Array<{ chunk: string; sequenceNumber: number }>>([])
  
  const { isConnected, sendMessage, lastMessage } = useWebSocket();

  // Log all messages
  const log = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[WebSocket Debug] ${message}`);
    setMessages(prev => [...prev, `${timestamp}: ${message}`]);
  };

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;
    
    try {
      const message = JSON.parse(lastMessage.data);
      log(`Received: ${message.type}`);
      
      switch (message.type) {
        case 'recording-started':
          setSessionId(message.sessionId);
          sessionIdRef.current = message.sessionId;
          log(`Session started: ${message.sessionId}`);
          
          // Send any pending chunks
          if (pendingChunksRef.current.length > 0) {
            log(`Sending ${pendingChunksRef.current.length} pending chunks`);
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
          log(`Recording stopped: ${JSON.stringify(message)}`);
          break;
          
        case 'chunk-received':
          log(`Chunk acknowledged: seq ${message.sequenceNumber}`);
          break;
          
        case 'error':
          log(`ERROR: ${message.message}`);
          toast.error(message.message);
          break;
          
        default:
          log(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      log(`Failed to parse message: ${error}`);
    }
  }, [lastMessage, sendMessage]);

  const startRecording = async () => {
    log('Starting recording...');
    setMessages([]);
    setAudioChunkCount(0);
    
    try {
      // Step 1: Get microphone access
      log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      log('Microphone access granted');
      
      // Step 2: Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;
      
      // Step 3: Send start-recording message
      log('Sending start-recording message...');
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
      
      // Step 4: Set up audio chunk handler
      let chunkNumber = 0;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          const currentSessionId = sessionIdRef.current;
          const currentChunkNum = chunkNumber++;
          log(`Chunk ${currentChunkNum}: size=${event.data.size}, sessionId=${currentSessionId}`);
          
          // Convert to base64
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result?.toString().split(',')[1];
            if (base64) {
              if (currentSessionId) {
                log(`Sending chunk ${currentChunkNum} to WebSocket`);
                sendMessage({
                  action: 'audio-stream',
                  type: 'audio-chunk',
                  sessionId: currentSessionId,
                  chunk: base64,
                  sequenceNumber: currentChunkNum,
                });
                setAudioChunkCount(prev => prev + 1);
              } else {
                log(`WARNING: No session ID, queuing chunk ${currentChunkNum}`);
                pendingChunksRef.current.push({ chunk: base64, sequenceNumber: currentChunkNum });
              }
            }
          };
          reader.readAsDataURL(event.data);
        }
      };
      
      // Step 5: Start recording immediately
      log('Starting MediaRecorder immediately (chunks will be queued if needed)');
      mediaRecorder.start(1000); // 1000ms chunks as per spec
      setIsRecording(true);
      
    } catch (error) {
      log(`ERROR: Failed to start recording: ${error}`);
      toast.error('Failed to access microphone');
    }
  };

  const stopRecording = () => {
    log('Stopping recording...');
    
    if (!mediaRecorderRef.current) {
      log('ERROR: No media recorder');
      return;
    }
    
    if (!sessionIdRef.current) {
      log('ERROR: No session ID');
      return;
    }
    
    // Stop the media recorder
    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    
    // Send stop message
    log(`Sending stop-recording for session: ${sessionIdRef.current}`);
    sendMessage({
      action: 'audio-stream',
      type: 'stop-recording',
      sessionId: sessionIdRef.current,
    });
    
    setIsRecording(false);
    mediaRecorderRef.current = null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            WebSocket Debug Recording
          </CardTitle>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <>
                <Wifi className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-600">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-red-600" />
                <span className="text-sm text-red-600">Disconnected</span>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Status Info */}
          <div className="text-center space-y-1">
            <div className="text-sm">
              Recording: <span className="font-semibold">{isRecording ? 'Yes' : 'No'}</span>
            </div>
            <div className="text-sm">
              Session ID: <span className="font-mono text-xs">{sessionId || 'None'}</span>
            </div>
            <div className="text-sm">
              Audio Chunks Sent: <span className="font-semibold">{audioChunkCount}</span>
            </div>
          </div>
          
          {/* Controls */}
          <div className="flex items-center justify-center gap-3">
            {!isRecording ? (
              <Button 
                onClick={startRecording} 
                disabled={!isConnected}
                size="lg"
              >
                <Mic className="h-5 w-5 mr-2" />
                Start Debug Recording
              </Button>
            ) : (
              <Button 
                onClick={stopRecording}
                variant="destructive"
                size="lg"
              >
                <Square className="h-4 w-4 mr-2" />
                Stop Recording
              </Button>
            )}
          </div>
          
          {/* Debug Log */}
          <div className="border rounded-lg p-3 h-48 overflow-y-auto bg-gray-50">
            <div className="text-xs font-mono space-y-1">
              {messages.length === 0 ? (
                <div className="text-gray-400">Debug log will appear here...</div>
              ) : (
                messages.map((msg, idx) => (
                  <div 
                    key={idx} 
                    className={
                      msg.includes('ERROR') ? 'text-red-600' : 
                      msg.includes('WARNING') ? 'text-orange-600' : 
                      ''
                    }
                  >
                    {msg}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}