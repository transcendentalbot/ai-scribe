import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';

interface UseSimpleAudioRecordingOptions {
  encounterId: string;
  onRecordingComplete?: (audioUrl: string) => void;
  onError?: (error: Error) => void;
}

export const useSimpleAudioRecording = ({
  encounterId,
  onRecordingComplete,
  onError,
}: UseSimpleAudioRecordingOptions) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const startRecording = useCallback(async () => {
    try {
      // Reset previous recording
      chunksRef.current = [];
      setAudioUrl(null);
      
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        } 
      });

      // Create MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : 'audio/mp4';
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });

      mediaRecorderRef.current = mediaRecorder;

      // Collect audio chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        // Create blob from chunks
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        
        // Create object URL for playback
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        
        // Upload to S3 (you'll need to implement this endpoint)
        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, `recording-${Date.now()}.${mimeType.split('/')[1]}`);
          formData.append('encounterId', encounterId);
          
          // For now, just save locally
          onRecordingComplete?.(url);
          toast.success('Recording saved successfully');
        } catch (error) {
          console.error('Failed to upload recording:', error);
          onError?.(error as Error);
        }
      };

      // Start recording
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      startTimeRef.current = Date.now();
      
      // Update duration every second
      durationIntervalRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Failed to start recording. Please check microphone permissions.');
      onError?.(error as Error);
    }
  }, [encounterId, onRecordingComplete, onError]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }
  }, []);

  return {
    isRecording,
    duration,
    audioUrl,
    startRecording,
    stopRecording,
  };
};