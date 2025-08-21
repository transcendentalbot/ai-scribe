'use client';

import { useState, useRef } from 'react';
import { Wifi, WifiOff, Mic, Square, Activity, Bot, User, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWebSocket } from '@/hooks/useWebSocket';
import { usePCMRecording } from '@/hooks/usePCMRecording';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TranscriptionSegment {
  encounterId: string;
  timestamp: number;
  text: string;
  speaker?: string;
  confidence?: number;
  entities?: Array<{
    type: 'medication' | 'symptom' | 'vital' | 'condition';
    text: string;
    value?: string;
    unit?: string;
  }>;
  isPartial?: boolean;
}

interface RealTimeTranscriptionProps {
  encounterId: string;
  onTranscriptionStart?: () => void;
  onTranscriptionStop?: () => void;
}

// Speaker icons
const speakerIcons: Record<string, React.ReactElement> = {
  Doctor: <User className="h-4 w-4" />,
  Patient: <Bot className="h-4 w-4" />,
  Other: <User className="h-4 w-4" />,
  Unknown: <User className="h-4 w-4" />,
};

// Entity icons
const entityIcons = {
  medication: <span className="text-xs">💊</span>,
  symptom: <span className="text-xs">🤒</span>,
  vital: <span className="text-xs">❤️</span>,
  condition: <span className="text-xs">🏥</span>,
};

export function RealTimeTranscription({ encounterId, onTranscriptionStart, onTranscriptionStop }: RealTimeTranscriptionProps) {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionSessionId, setTranscriptionSessionId] = useState<string | null>(null);
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'transcribing' | 'error'>('idle');
  
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const lastTranscriptRef = useRef<string>('');
  
  const { isConnected } = useWebSocket();
  const { 
    startRecording, 
    stopRecording, 
    duration
  } = usePCMRecording({
    encounterId,
    onRecordingStarted: (data: { transcriptionSessionId?: string }) => {
      if (data.transcriptionSessionId) {
        setTranscriptionSessionId(data.transcriptionSessionId);
        setStatus('transcribing');
        toast.success('Real-time transcription started');
        onTranscriptionStart?.();
      }
    },
    onRecordingStopped: (data: { transcriptCount?: number }) => {
      setTranscriptionSessionId(null);
      setStatus('idle');
      setIsTranscribing(false);
      onTranscriptionStop?.();
      if (data.transcriptCount && data.transcriptCount > 0) {
        toast.success(`Recording saved with ${data.transcriptCount} transcript segments`);
      }
    },
    onMessage: (message: { type: string; segment?: TranscriptionSegment; isPartial?: boolean }) => {
      // Handle transcript segments from live streaming
      if (message.type === 'transcript' && message.segment) {
        const segment = message.segment as TranscriptionSegment;
        
        // Deduplicate - only add if text is different from last
        if (segment.text === lastTranscriptRef.current && !message.isPartial) {
          return; // Skip duplicate
        }
        
        if (message.isPartial) {
          // Update the last segment if it's partial
          setSegments(prev => {
            const newSegments = [...prev];
            if (newSegments.length > 0 && newSegments[newSegments.length - 1].isPartial) {
              newSegments[newSegments.length - 1] = segment;
            } else {
              newSegments.push(segment);
            }
            return newSegments;
          });
        } else {
          // Add final segment (non-partial)
          lastTranscriptRef.current = segment.text; // Update last transcript
          setSegments(prev => {
            const newSegments = [...prev];
            // Remove last partial segment if exists
            if (newSegments.length > 0 && newSegments[newSegments.length - 1].isPartial) {
              newSegments[newSegments.length - 1] = segment;
            } else {
              newSegments.push(segment);
            }
            return newSegments;
          });
        }
        
        // Auto-scroll to bottom if enabled
        if (autoScrollRef.current && transcriptContainerRef.current) {
          setTimeout(() => {
            transcriptContainerRef.current?.scrollTo({
              top: transcriptContainerRef.current.scrollHeight,
              behavior: 'smooth'
            });
          }, 100);
        }
      }
    },
    onError: () => {
      setStatus('error');
      toast.error('Transcription error occurred');
    }
  });

  const handleStartTranscription = async () => {
    try {
      setStatus('connecting');
      setSegments([]);
      setIsTranscribing(true);
      
      // Start recording with transcription enabled
      await startRecording({
        enableTranscription: true,
        metadata: {
          transcriptionProvider: 'deepgram',
          model: 'nova-2-medical',
        }
      });
    } catch (error) {
      console.error('Failed to start transcription:', error);
      setStatus('error');
      setIsTranscribing(false);
      toast.error('Failed to start transcription');
    }
  };

  const handleStopTranscription = async () => {
    try {
      await stopRecording();
    } catch (error) {
      console.error('Failed to stop transcription:', error);
      toast.error('Failed to stop transcription');
    }
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Render entity with highlighting
  const renderTextWithEntities = (text: string, entities?: TranscriptionSegment['entities']) => {
    if (!entities || entities.length === 0) return text;

    // Sort entities by position in text
    const sortedEntities = [...entities].sort((a, b) => 
      text.toLowerCase().indexOf(a.text.toLowerCase()) - 
      text.toLowerCase().indexOf(b.text.toLowerCase())
    );

    let lastIndex = 0;
    const parts: React.ReactNode[] = [];

    sortedEntities.forEach((entity, idx) => {
      const startIndex = text.toLowerCase().indexOf(entity.text.toLowerCase(), lastIndex);
      if (startIndex === -1) return;

      // Add text before entity
      if (startIndex > lastIndex) {
        parts.push(text.substring(lastIndex, startIndex));
      }

      // Add entity with highlighting
      parts.push(
        <span
          key={`entity-${idx}`}
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium",
            {
              'bg-blue-100 text-blue-800': entity.type === 'medication',
              'bg-red-100 text-red-800': entity.type === 'symptom',
              'bg-green-100 text-green-800': entity.type === 'vital',
              'bg-purple-100 text-purple-800': entity.type === 'condition',
            }
          )}
          title={entity.value ? `${entity.text}: ${entity.value}${entity.unit || ''}` : entity.text}
        >
          {entityIcons[entity.type]}
          <span>{entity.text}</span>
          {entity.value && (
            <span className="font-semibold">
              {entity.value}
              {entity.unit || ''}
            </span>
          )}
        </span>
      );

      lastIndex = startIndex + entity.text.length;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return <>{parts}</>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Real-time Transcription
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
          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {!isTranscribing ? (
                <Button 
                  onClick={handleStartTranscription} 
                  disabled={!isConnected}
                  size="lg"
                >
                  <Mic className="h-5 w-5 mr-2" />
                  Start Transcription
                </Button>
              ) : (
                <Button 
                  onClick={handleStopTranscription}
                  variant="destructive"
                  size="lg"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop Transcription
                </Button>
              )}
              
              {isTranscribing && (
                <div className="text-2xl font-mono font-bold">
                  {formatDuration(duration)}
                </div>
              )}
            </div>

            {status === 'connecting' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                <span>Establishing transcription session, please wait...</span>
              </div>
            )}

            {status === 'transcribing' && (
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm text-muted-foreground">Live</span>
              </div>
            )}
          </div>

          {/* Transcript Display */}
          <div className="border rounded-lg bg-gray-50">
            <div className="p-3 border-b bg-white">
              <h3 className="font-semibold">Transcription</h3>
            </div>
            <div 
              ref={transcriptContainerRef}
              className="h-96 overflow-y-auto p-4 space-y-4"
              onScroll={(e) => {
                const element = e.currentTarget;
                const isAtBottom = element.scrollHeight - element.scrollTop === element.clientHeight;
                autoScrollRef.current = isAtBottom;
              }}
            >
              {segments.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  {isTranscribing 
                    ? "Waiting for speech..." 
                    : "No transcription available"
                  }
                </div>
              ) : (
                segments.map((segment, index) => (
                  <div
                    key={`${segment.timestamp}-${index}`}
                    className={cn(
                      "flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300",
                      segment.isPartial && "opacity-60"
                    )}
                  >
                    {/* Speaker Icon */}
                    <div className="flex-shrink-0 pt-1">
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center",
                        {
                          'bg-blue-100 text-blue-600': segment.speaker === 'Doctor',
                          'bg-green-100 text-green-600': segment.speaker === 'Patient',
                          'bg-gray-100 text-gray-600': segment.speaker === 'Other' || segment.speaker === 'Unknown',
                        }
                      )}>
                        {speakerIcons[segment.speaker || 'Unknown']}
                      </div>
                    </div>

                    {/* Transcript Content */}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{segment.speaker || 'Unknown'}</span>
                        <span className="text-muted-foreground">
                          {new Date(segment.timestamp).toLocaleTimeString()}
                        </span>
                        {segment.confidence !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            ({Math.round(segment.confidence * 100)}%)
                          </span>
                        )}
                      </div>
                      <div className="text-sm leading-relaxed">
                        {renderTextWithEntities(segment.text, segment.entities)}
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Scroll to bottom indicator */}
              {!autoScrollRef.current && segments.length > 0 && (
                <button
                  onClick={() => {
                    autoScrollRef.current = true;
                    transcriptContainerRef.current?.scrollTo({
                      top: transcriptContainerRef.current.scrollHeight,
                      behavior: 'smooth'
                    });
                  }}
                  className="sticky bottom-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm shadow-lg"
                >
                  Jump to latest
                </button>
              )}
            </div>
          </div>

          {/* Error State */}
          {status === 'error' && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-800 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">
                Transcription error occurred. Please try again.
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}