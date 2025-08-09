'use client';

import { useState, useEffect, useRef } from 'react';
import { Mic, Pause, Play, Square, Volume2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RecordingInterfaceProps {
  encounterId: string;
  isRecording: boolean;
  onToggleRecording: () => void;
}

export function RecordingInterface({ 
  isRecording, 
  onToggleRecording 
}: RecordingInterfaceProps) {
  const [duration, setDuration] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (isRecording && !isPaused) {
      intervalRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

      // Set up audio level monitoring
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          audioContextRef.current = new AudioContext();
          const source = audioContextRef.current.createMediaStreamSource(stream);
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 256;
          source.connect(analyserRef.current);

          const updateAudioLevel = () => {
            if (analyserRef.current) {
              const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
              analyserRef.current.getByteFrequencyData(dataArray);
              const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
              setAudioLevel(average / 255);
            }
            animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
          };
          updateAudioLevel();
        })
        .catch(err => console.error('Error accessing microphone:', err));
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [isRecording, isPaused]);

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
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsProcessing(false);
    onToggleRecording();
    setDuration(0);
    setIsPaused(false);
  };

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
                    height: isRecording ? `${Math.max(8, audioLevel * 64 * (1 + Math.sin(Date.now() / 100 + i) * 0.3))}px` : '8px'
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
                onClick={() => setIsPaused(!isPaused)}
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
                <p className="font-semibold text-green-600">Excellent</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Network Status</p>
                <p className="font-semibold text-green-600">Connected</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Storage</p>
                <p className="font-semibold text-gray-900">Cloud</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}