import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

interface UseSimpleAudioRecordingOptions {
  encounterId: string;
  onRecordingComplete?: (audioUrl: string) => void;
  onError?: (error: Error) => void;
}

const STORAGE_KEY_PREFIX = 'ai-scribe-recording-';

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

  // Load saved recording from localStorage on mount
  useEffect(() => {
    const storageKey = `${STORAGE_KEY_PREFIX}${encounterId}`;
    const savedData = localStorage.getItem(storageKey);
    
    if (savedData) {
      try {
        const { audioData, mimeType, duration: savedDuration } = JSON.parse(savedData);
        // Convert base64 back to blob
        const byteCharacters = atob(audioData);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setDuration(savedDuration || 0);
        toast.info('Previous recording loaded');
      } catch (error) {
        console.error('Failed to load saved recording:', error);
      }
    }
  }, [encounterId]);

  const saveToLocalStorage = useCallback(async (blob: Blob, mimeType: string) => {
    try {
      // Convert blob to base64 for localStorage
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result?.toString().split(',')[1];
        if (base64data) {
          const storageKey = `${STORAGE_KEY_PREFIX}${encounterId}`;
          const dataToSave = {
            audioData: base64data,
            mimeType,
            duration,
            timestamp: new Date().toISOString(),
            encounterId,
          };
          localStorage.setItem(storageKey, JSON.stringify(dataToSave));
          toast.success('Recording saved locally');
        }
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
      toast.error('Failed to save recording locally');
    }
  }, [encounterId, duration]);

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
        
        // Save to localStorage
        await saveToLocalStorage(audioBlob, mimeType);
        
        // Upload to S3 (you'll need to implement this endpoint)
        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, `recording-${Date.now()}.${mimeType.split('/')[1]}`);
          formData.append('encounterId', encounterId);
          
          // For now, just save locally
          onRecordingComplete?.(url);
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

  const clearRecording = useCallback(() => {
    const storageKey = `${STORAGE_KEY_PREFIX}${encounterId}`;
    localStorage.removeItem(storageKey);
    setAudioUrl(null);
    setDuration(0);
    toast.info('Recording cleared');
  }, [encounterId]);

  return {
    isRecording,
    duration,
    audioUrl,
    startRecording,
    stopRecording,
    clearRecording,
  };
};