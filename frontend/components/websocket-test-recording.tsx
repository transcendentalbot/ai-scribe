'use client';

import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Mic, Square, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWebSocketRecording } from '@/hooks/useWebSocketRecording';

interface WebSocketTestRecordingProps {
  encounterId: string;
}

export function WebSocketTestRecording({ encounterId }: WebSocketTestRecordingProps) {
  const [messages, setMessages] = useState<string[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  
  const {
    isRecording,
    isConnected,
    sessionId,
    duration,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  } = useWebSocketRecording({
    encounterId,
    onRecordingComplete: (recordingId) => {
      const timestamp = new Date().toLocaleTimeString();
      setMessages(prev => [...prev, `${timestamp}: Recording completed (ID: ${recordingId})`]);
    },
  });

  // Add status messages based on recording state
  useEffect(() => {
    if (isRecording && sessionId) {
      const timestamp = new Date().toLocaleTimeString();
      setMessages(prev => [...prev, `${timestamp}: Recording started (Session: ${sessionId})`]);
    }
  }, [isRecording, sessionId]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePauseResume = () => {
    if (isPaused) {
      resumeRecording();
      setIsPaused(false);
      const timestamp = new Date().toLocaleTimeString();
      setMessages(prev => [...prev, `${timestamp}: Recording resumed`]);
    } else {
      pauseRecording();
      setIsPaused(true);
      const timestamp = new Date().toLocaleTimeString();
      setMessages(prev => [...prev, `${timestamp}: Recording paused`]);
    }
  };

  const handleStart = () => {
    setMessages([]);
    startRecording();
  };

  const handleStop = () => {
    const timestamp = new Date().toLocaleTimeString();
    setMessages(prev => [...prev, `${timestamp}: Stopping recording...`]);
    stopRecording();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            WebSocket Recording Test
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
          {/* Duration Display */}
          {isRecording && (
            <div className="text-center">
              <div className="text-3xl font-mono font-bold">
                {formatDuration(duration)}
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {isPaused ? 'Paused' : 'Recording...'}
              </p>
            </div>
          )}
          
          {/* Controls */}
          <div className="flex items-center justify-center gap-3">
            {!isRecording ? (
              <Button 
                onClick={handleStart} 
                disabled={!isConnected}
                size="lg"
              >
                <Mic className="h-5 w-5 mr-2" />
                Start WebSocket Recording
              </Button>
            ) : (
              <>
                <Button 
                  onClick={handlePauseResume}
                  variant="outline"
                  size="lg"
                >
                  {isPaused ? (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Resume
                    </>
                  ) : (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </>
                  )}
                </Button>
                <Button 
                  onClick={handleStop}
                  variant="destructive"
                  size="lg"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop Recording
                </Button>
              </>
            )}
          </div>
          
          {/* Session Info */}
          {sessionId && (
            <div className="text-center text-sm text-gray-600">
              Session ID: {sessionId}
            </div>
          )}
          
          {/* Message Log */}
          <div className="border rounded-lg p-3 h-32 overflow-y-auto bg-gray-50">
            <div className="text-xs font-mono space-y-1">
              {messages.length === 0 ? (
                <div className="text-gray-400">No messages yet...</div>
              ) : (
                messages.map((msg, idx) => (
                  <div key={idx} className={msg.includes('ERROR') ? 'text-red-600' : ''}>
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