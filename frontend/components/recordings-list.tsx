'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { Play, Pause, Download, Mic, Clock, Calendar, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { recordingApi } from '@/lib/api';
import { toast } from 'sonner';
import { debugAudioPlayback, logDebugInfo } from '@/lib/debug-audio';

interface Recording {
  id: string;
  startTime: string;
  endTime: string;
  duration: number;
  s3Key: string;
  url: string;
  transcriptionId?: string;
  mimeType?: string;
  fileSize?: number;
  createdAt?: string;
  debugInfo?: unknown;
}

interface RecordingsListProps {
  encounterId: string;
  onNewRecording?: () => void;
  onRecordingSelect?: (recordingId: string) => void;
}

export function RecordingsList({ encounterId, onNewRecording, onRecordingSelect }: RecordingsListProps) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement] = useState<HTMLAudioElement | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const fetchRecordings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await recordingApi.getRecordings(encounterId);
      setRecordings(data.recordings || []);
    } catch (error) {
      console.error('Failed to fetch recordings:', error);
      toast.error('Failed to load recordings');
    } finally {
      setLoading(false);
    }
  }, [encounterId]);

  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

  useEffect(() => {
    return () => {
      // Cleanup audio on unmount
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }
    };
  }, [audioElement]);


  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = async (recording: Recording) => {
    if (!audioRef.current) return;
    
    if (playingId === recording.id) {
      // Pause current recording
      audioRef.current.pause();
      setPlayingId(null);
    } else {
      try {
        // Stop any current playback
        audioRef.current.pause();
        
        // Extensive logging for debugging
        console.group('🎵 Audio Playback Debug Info');
        console.log('Recording details:', {
          id: recording.id,
          url: recording.url,
          s3Key: recording.s3Key,
          mimeType: recording.mimeType,
          duration: recording.duration,
          fileSize: recording.fileSize,
          createdAt: recording.createdAt,
          debugInfo: 'debugInfo' in recording ? recording.debugInfo : undefined,
        });
        
        // Test URL accessibility
        console.log('Testing URL accessibility...');
        try {
          const headResponse = await fetch(recording.url, { method: 'HEAD' });
          console.log('HEAD request response:', {
            status: headResponse.status,
            statusText: headResponse.statusText,
            contentType: headResponse.headers.get('content-type'),
            contentLength: headResponse.headers.get('content-length'),
            headers: Array.from(headResponse.headers.entries()),
          });
        } catch (fetchError) {
          console.error('Failed to fetch HEAD:', fetchError);
        }
        
        // Check browser audio format support
        const audio = audioRef.current;
        console.log('Browser audio support:', {
          webm: audio.canPlayType('audio/webm'),
          webmOpus: audio.canPlayType('audio/webm;codecs=opus'),
          ogg: audio.canPlayType('audio/ogg'),
          oggOpus: audio.canPlayType('audio/ogg;codecs=opus'),
          mp4: audio.canPlayType('audio/mp4'),
        });
        
        // Set new source
        console.log('Setting audio source...');
        audioRef.current.src = recording.url;
        
        // Add load event listeners for debugging
        const loadStartHandler = () => console.log('⏳ loadstart event fired');
        const loadedMetadataHandler = () => {
          console.log('✅ loadedmetadata event fired:', {
            duration: audio.duration,
            readyState: audio.readyState,
            networkState: audio.networkState,
          });
        };
        const canPlayHandler = () => console.log('✅ canplay event fired');
        const canPlayThroughHandler = () => console.log('✅ canplaythrough event fired');
        
        audio.addEventListener('loadstart', loadStartHandler);
        audio.addEventListener('loadedmetadata', loadedMetadataHandler);
        audio.addEventListener('canplay', canPlayHandler);
        audio.addEventListener('canplaythrough', canPlayThroughHandler);
        
        // Try to load and play
        console.log('Loading audio...');
        await audioRef.current.load();
        console.log('Audio loaded, attempting to play...');
        await audioRef.current.play();
        console.log('✅ Audio playing successfully');
        console.groupEnd();
        
        // Clean up event listeners
        audio.removeEventListener('loadstart', loadStartHandler);
        audio.removeEventListener('loadedmetadata', loadedMetadataHandler);
        audio.removeEventListener('canplay', canPlayHandler);
        audio.removeEventListener('canplaythrough', canPlayThroughHandler);
        
        setPlayingId(recording.id);
        
      } catch (error) {
        console.error('❌ Failed to play audio:', error);
        console.groupEnd();
        
        // Check if it's a CORS issue
        if (error instanceof Error) {
          if (error.name === 'NotAllowedError') {
            toast.error('Playback not allowed. Please try clicking play again.');
          } else if (error.name === 'NotSupportedError') {
            toast.error('Audio format not supported by your browser. Try downloading the file instead.');
          } else {
            toast.error('Failed to play recording. Try downloading it instead.');
          }
        } else {
          toast.error('Failed to play recording. Try downloading it instead.');
        }
        
        setPlayingId(null);
      }
    }
  };

  const handleDownload = async (recording: Recording) => {
    try {
      const response = await fetch(recording.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recording-${recording.id}.webm`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Recording downloaded');
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download recording');
    }
  };

  // Refresh recordings when a new one is added
  useEffect(() => {
    if (onNewRecording) {
      // Store the callback so parent component can trigger refresh
      const windowWithCallback = window as Window & { _refreshRecordings?: () => void };
      windowWithCallback._refreshRecordings = fetchRecordings;
    }
    return () => {
      const windowWithCallback = window as Window & { _refreshRecordings?: () => void };
      delete windowWithCallback._refreshRecordings;
    };
  }, [fetchRecordings, onNewRecording]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Recordings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            Loading recordings...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Recordings ({recordings.length})
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchRecordings}
          >
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {recordings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No recordings yet
          </div>
        ) : (
          <div className="space-y-3">
            {recordings.map((recording) => (
              <div
                key={recording.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => onRecordingSelect?.(recording.id)}
              >
                <div className="flex items-center gap-4">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full"
                    onClick={() => handlePlayPause(recording)}
                  >
                    {playingId === recording.id ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(recording.startTime), 'MMM d, yyyy h:mm a')}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="h-3 w-3" />
                      Duration: {formatDuration(recording.duration)}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {recording.transcriptionId && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      Transcribed
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDownload(recording)}
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      const debugInfo = await debugAudioPlayback(recording);
                      logDebugInfo(debugInfo);
                      toast.info('Debug info logged to console');
                    }}
                    title="Debug Audio"
                  >
                    <Bug className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
    {/* Hidden audio element for playback */}
    <audio 
      ref={audioRef} 
      style={{ display: 'none' }}
      onEnded={() => setPlayingId(null)}
      onError={(e) => {
        const audio = e.currentTarget as HTMLAudioElement;
        console.error('Audio element error:', e);
        console.error('Audio error details:', {
          code: audio.error?.code,
          message: audio.error?.message,
          src: audio.src,
          currentSrc: audio.currentSrc,
          networkState: audio.networkState,
          readyState: audio.readyState
        });
        
        let errorMessage = 'Failed to play recording';
        
        // MediaError codes: 1=ABORTED, 2=NETWORK, 3=DECODE, 4=SRC_NOT_SUPPORTED
        if (audio.error?.code === 4) {
          errorMessage = 'Audio format not supported. Try downloading the file.';
        } else if (audio.error?.code === 3) {
          errorMessage = 'Audio decoding error. File may be corrupted.';
        } else if (audio.error?.code === 2) {
          errorMessage = 'Network error loading audio.';
        }
        
        toast.error(errorMessage);
        setPlayingId(null);
      }}
    />
    </>
  );
}