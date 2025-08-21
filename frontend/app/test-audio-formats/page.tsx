'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface FormatTest {
  format: string;
  supported: boolean;
  recordingSupported?: boolean;
  playbackTest?: {
    canPlay: string;
    error?: string;
  };
  testFile?: {
    url: string;
    size: number;
    duration?: number;
    metadata?: Record<string, unknown>;
  };
}

export default function TestAudioFormatsPage() {
  const [formats, setFormats] = useState<FormatTest[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlobs, setRecordedBlobs] = useState<Record<string, Blob>>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const testFormats = [
    'audio/webm',
    'audio/webm;codecs=opus',
    'audio/webm;codecs=vorbis',
    'audio/ogg',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/wav',
    'audio/flac',
  ];

  const checkFormatsSupport = () => {
    const results: FormatTest[] = testFormats.map(format => {
      const audio = new Audio();
      const canPlayType = audio.canPlayType(format);
      
      return {
        format,
        supported: canPlayType !== '',
        recordingSupported: typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(format),
        playbackTest: {
          canPlay: canPlayType || 'no',
        },
      };
    });

    setFormats(results);
  };

  const testRecording = async (format: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      
      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType: format,
        audioBitsPerSecond: 128000 
      });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: format });
        setRecordedBlobs(prev => ({ ...prev, [format]: blob }));
        
        // Update format test with file info
        setFormats(prev => prev.map(f => {
          if (f.format === format) {
            return {
              ...f,
              testFile: {
                url: URL.createObjectURL(blob),
                size: blob.size,
              },
            };
          }
          return f;
        }));
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);

      // Record for 2 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
        }
      }, 2000);

    } catch (error) {
      console.error('Recording error:', error);
      alert(`Failed to record with ${format}: ${error}`);
    }
  };

  const testPlayback = async (format: string, url: string) => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }

    const audio = audioRef.current;
    
    try {
      audio.src = url;
      
      // Test loading metadata
      await new Promise((resolve, reject) => {
        audio.onloadedmetadata = () => {
          setFormats(prev => prev.map(f => {
            if (f.format === format && f.testFile) {
              return {
                ...f,
                testFile: {
                  ...f.testFile,
                  duration: audio.duration,
                  metadata: {
                    duration: audio.duration,
                    readyState: audio.readyState,
                    networkState: audio.networkState,
                  },
                },
              };
            }
            return f;
          }));
          resolve(true);
        };
        
        audio.onerror = () => {
          const error = `Error code: ${audio.error?.code}, message: ${audio.error?.message}`;
          setFormats(prev => prev.map(f => {
            if (f.format === format && f.playbackTest) {
              return {
                ...f,
                playbackTest: {
                  ...f.playbackTest,
                  error,
                },
              };
            }
            return f;
          }));
          reject(error);
        };
        
        audio.load();
      });

      // Try to play
      await audio.play();
      audio.pause();
      
    } catch (error) {
      console.error('Playback error:', error);
    }
  };

  const downloadTestFile = (format: string) => {
    const blob = recordedBlobs[format];
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-audio-${format.replace(/[^a-z0-9]/gi, '-')}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const analyzeWebMFile = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    // Check WebM signature
    const signature = Array.from(bytes.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' ');
    const hasWebMSignature = bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
    
    // Look for codec info (simplified)
    const decoder = new TextDecoder();
    let codecInfo = 'Unknown';
    
    // Search for codec ID
    for (let i = 0; i < Math.min(bytes.length - 10, 5000); i++) {
      if (bytes[i] === 0x86) { // CodecID element
        const length = bytes[i + 1] & 0x7f;
        if (length > 0 && length < 50) {
          codecInfo = decoder.decode(bytes.slice(i + 2, i + 2 + length));
          break;
        }
      }
    }

    return {
      signature,
      hasWebMSignature,
      codecInfo,
      size: file.size,
      firstBytes: Array.from(bytes.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' '),
    };
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Audio Format Compatibility Test</h1>
      
      <div className="mb-6 space-x-4">
        <Button onClick={checkFormatsSupport}>Check Format Support</Button>
        <Button 
          onClick={() => {
            if (isRecording && mediaRecorderRef.current) {
              mediaRecorderRef.current.stop();
              setIsRecording(false);
            }
          }}
          disabled={!isRecording}
          variant="destructive"
        >
          Stop Recording
        </Button>
      </div>

      <div className="grid gap-4">
        {formats.map((format) => (
          <Card key={format.format}>
            <CardHeader>
              <CardTitle className="text-lg">{format.format}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Playback Support:</span>
                  <span className={format.playbackTest?.canPlay !== 'no' ? 'text-green-600' : 'text-red-600'}>
                    {format.playbackTest?.canPlay || 'Not tested'}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Recording Support:</span>
                  <span className={format.recordingSupported ? 'text-green-600' : 'text-red-600'}>
                    {format.recordingSupported ? 'Yes' : 'No'}
                  </span>
                </div>

                {format.playbackTest?.error && (
                  <Alert variant="destructive">
                    <AlertDescription>{format.playbackTest.error}</AlertDescription>
                  </Alert>
                )}

                {format.testFile && (
                  <div className="mt-4 p-4 bg-gray-100 rounded">
                    <p className="text-sm">Test file created:</p>
                    <p className="text-sm">Size: {(format.testFile.size / 1024).toFixed(2)} KB</p>
                    {format.testFile.duration && (
                      <p className="text-sm">Duration: {format.testFile.duration.toFixed(2)}s</p>
                    )}
                    <div className="mt-2 space-x-2">
                      <Button 
                        size="sm" 
                        onClick={() => testPlayback(format.format, format.testFile!.url)}
                      >
                        Test Playback
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => downloadTestFile(format.format)}
                      >
                        Download
                      </Button>
                    </div>
                  </div>
                )}

                {format.recordingSupported && !format.testFile && (
                  <Button 
                    size="sm" 
                    onClick={() => testRecording(format.format)}
                    disabled={isRecording}
                  >
                    Test Recording (2s)
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Upload WebM File for Analysis</h2>
        <input
          type="file"
          accept="audio/webm,video/webm,.webm"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) {
              const analysis = await analyzeWebMFile(file);
              console.log('WebM Analysis:', analysis);
              alert(`WebM Analysis:
Signature: ${analysis.signature}
Valid WebM: ${analysis.hasWebMSignature}
Codec: ${analysis.codecInfo}
Size: ${(analysis.size / 1024).toFixed(2)} KB
First bytes: ${analysis.firstBytes}`);
            }
          }}
          className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50"
        />
      </div>
    </div>
  );
}