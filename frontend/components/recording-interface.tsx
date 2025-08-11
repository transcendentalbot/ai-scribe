'use client';

import { useState, useEffect } from 'react';
import { Mic, Pause, Play, Square, Volume2, Loader2, Wifi, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAudioRecording } from '@/hooks/useAudioRecording';
import { toast } from 'sonner';

interface RecordingInterfaceProps {
  encounterId: string;
  isRecording: boolean;
  onToggleRecording: () => void;
}

export function RecordingInterface({ 
  encounterId,
  isRecording: externalIsRecording, 
  onToggleRecording 
}: RecordingInterfaceProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const {
    isRecording,
    isPaused,
    duration,
    audioQuality,
    isConnected,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  } = useAudioRecording({
    encounterId,
    onRecordingStart: () => {
      console.log('Recording started');
    },
    onRecordingStop: (recordingId) => {
      console.log('Recording stopped:', recordingId);
      toast.success('Recording saved successfully');
      setIsProcessing(false);
      onToggleRecording();
    },
    onError: (error) => {
      toast.error(`Recording error: ${error.message}`);
      setIsProcessing(false);
    },
  });

  // Sync external recording state with internal state
  useEffect(() => {
    if (externalIsRecording && !isRecording) {
      startRecording();
    } else if (!externalIsRecording && isRecording) {
      handleStop();
    }
  }, [externalIsRecording]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStop = async () => {
    setIsProcessing(true);
    stopRecording();
  };

  const getAudioQualityStatus = () => {
    if (audioQuality.isClipping) return { text: 'Clipping', color: 'text-red-600' };
    if (audioQuality.volume < 10) return { text: 'Too Quiet', color: 'text-yellow-600' };
    if (audioQuality.noiseLevel > 50) return { text: 'Noisy', color: 'text-yellow-600' };
    return { text: 'Excellent', color: 'text-green-600' };
  };

  const audioQualityStatus = getAudioQualityStatus();

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Recording Session
          </CardTitle>
          <div className="flex items-center gap-2">
            {isRecording && (
              <div className="flex items-center gap-2 px-3 py-1 bg-red-100 rounded-full">
                <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-red-700">Recording</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="text-center mb-8">
          <div className="text-5xl font-mono font-bold text-gray-900 mb-2">
            {formatDuration(duration)}
          </div>
          
          {/* Audio Level Visualizer */}
          {isRecording && !isPaused && (
            <div className="flex items-center justify-center gap-1 h-16 mb-4">
              {Array.from({ length: 20 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="w-2 bg-gradient-to-t from-blue-500 to-indigo-500 rounded-full"
                  animate={{
                    height: isRecording ? `${Math.max(8, audioQuality.volume * 0.64 * (1 + Math.sin(Date.now() / 100 + i) * 0.3))}px` : '8px'
                  }}
                  transition={{ duration: 0.1 }}
                />
              ))}
            </div>
          )}

          {/* Status Text */}
          <p className="text-sm text-gray-600">
            {isProcessing ? 'Processing recording...' : 
             isRecording ? (isPaused ? 'Paused' : 'Recording in progress') : 
             'Click start to begin recording'}
          </p>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-center gap-4">
          {!isRecording ? (
            <Button
              size="lg"
              onClick={onToggleRecording}
              className="px-8"
              disabled={isProcessing}
            >
              <Mic className="h-5 w-5 mr-2" />
              Start Recording
            </Button>
          ) : (
            <>
              <Button
                size="lg"
                variant="outline"
                onClick={() => isPaused ? resumeRecording() : pauseRecording()}
                disabled={isProcessing}
              >
                {isPaused ? (
                  <>
                    <Play className="h-5 w-5 mr-2" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-5 w-5 mr-2" />
                    Pause
                  </>
                )}
              </Button>
              <Button
                size="lg"
                variant="destructive"
                onClick={handleStop}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Square className="h-5 w-5 mr-2" />
                    Stop Recording
                  </>
                )}
              </Button>
            </>
          )}
        </div>

        {/* Recording Tips */}
        <AnimatePresence>
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-8 p-4 bg-blue-50 rounded-lg"
            >
              <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                <Volume2 className="h-4 w-4" />
                Recording Tips
              </h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Speak clearly and at a normal pace</li>
                <li>• Minimize background noise</li>
                <li>• State patient identifiers at the beginning</li>
                <li>• Announce any procedures or examinations</li>
              </ul>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recording Status */}
        {isRecording && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-gray-600">Audio Quality</p>
                <p className={`font-semibold ${audioQualityStatus.color}`}>
                  {audioQualityStatus.text}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Network Status</p>
                <p className={`font-semibold flex items-center justify-center gap-1 ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                  {isConnected ? (
                    <>
                      <Wifi className="h-4 w-4" />
                      Connected
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-4 w-4" />
                      Disconnected
                    </>
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Storage</p>
                <p className="font-semibold text-gray-900">Cloud (S3)</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}