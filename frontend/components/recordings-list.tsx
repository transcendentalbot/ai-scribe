'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Play, Pause, Download, Mic, Clock, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { recordingApi } from '@/lib/api';
import { toast } from 'sonner';

interface Recording {
  id: string;
  startTime: string;
  endTime: string;
  duration: number;
  s3Key: string;
  url: string;
  transcriptionId?: string;
}

interface RecordingsListProps {
  encounterId: string;
  onNewRecording?: () => void;
}

export function RecordingsList({ encounterId, onNewRecording }: RecordingsListProps) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchRecordings();
    return () => {
      // Cleanup audio on unmount
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }
    };
  }, [encounterId]);

  const fetchRecordings = async () => {
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
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = (recording: Recording) => {
    if (playingId === recording.id) {
      // Pause current recording
      if (audioElement) {
        audioElement.pause();
        setPlayingId(null);
      }
    } else {
      // Play new recording
      if (audioElement) {
        audioElement.pause();
      }
      
      const audio = new Audio(recording.url);
      audio.onended = () => setPlayingId(null);
      audio.onerror = () => {
        toast.error('Failed to play recording');
        setPlayingId(null);
      };
      
      audio.play();
      setAudioElement(audio);
      setPlayingId(recording.id);
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
      const originalCallback = onNewRecording;
      onNewRecording = () => {
        originalCallback();
        fetchRecordings();
      };
    }
  }, [onNewRecording]);

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
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
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
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}