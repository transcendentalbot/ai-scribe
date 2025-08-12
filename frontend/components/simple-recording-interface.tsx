'use client';

import { Mic, Square, Download, Play, Pause, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSimpleAudioRecording } from '@/hooks/useSimpleAudioRecording';
import { useState, useRef } from 'react';

interface SimpleRecordingInterfaceProps {
  encounterId: string;
}

export function SimpleRecordingInterface({ encounterId }: SimpleRecordingInterfaceProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const {
    isRecording,
    duration,
    audioUrl,
    startRecording,
    stopRecording,
    clearRecording,
  } = useSimpleAudioRecording({
    encounterId,
    onRecordingComplete: (url) => {
      console.log('Recording complete:', url);
    },
  });

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlayback = () => {
    if (!audioRef.current || !audioUrl) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const downloadRecording = () => {
    if (!audioUrl) return;
    
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `recording-${encounterId}-${Date.now()}.webm`;
    a.click();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Simple Audio Recording
          </CardTitle>
          {audioUrl && !isRecording && (
            <span className="text-sm text-green-600 font-medium">
              Recording saved locally
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-center space-y-4">
          {/* Duration Display */}
          <div className="text-4xl font-mono font-bold">
            {formatDuration(duration)}
          </div>

          {/* Recording Status */}
          <p className="text-sm text-gray-600">
            {isRecording ? 'Recording in progress...' : 
             audioUrl ? 'Recording complete' : 
             'Click start to begin recording'}
          </p>

          {/* Control Buttons */}
          <div className="flex items-center justify-center gap-3">
            {!isRecording && !audioUrl && (
              <Button onClick={startRecording} size="lg">
                <Mic className="h-5 w-5 mr-2" />
                Start Recording
              </Button>
            )}

            {isRecording && (
              <Button 
                onClick={stopRecording} 
                variant="destructive" 
                size="lg"
              >
                <Square className="h-4 w-4 mr-2" />
                Stop Recording
              </Button>
            )}

            {audioUrl && !isRecording && (
              <>
                <Button 
                  onClick={togglePlayback}
                  variant="outline"
                  size="lg"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Play
                    </>
                  )}
                </Button>
                
                <Button 
                  onClick={downloadRecording}
                  variant="outline"
                  size="lg"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                
                <Button 
                  onClick={clearRecording}
                  variant="outline"
                  size="lg"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear
                </Button>
                
                <Button 
                  onClick={startRecording}
                  size="lg"
                >
                  <Mic className="h-5 w-5 mr-2" />
                  New Recording
                </Button>
              </>
            )}
          </div>

          {/* Hidden Audio Element */}
          {audioUrl && (
            <audio
              ref={audioRef}
              src={audioUrl}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}