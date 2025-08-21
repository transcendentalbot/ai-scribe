'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Clock, FileText } from 'lucide-react';
import { transcriptApi } from '@/lib/api';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface TranscriptionSegment {
  timestamp: number;
  text: string;
  speaker: string;
  confidence?: number;
  entities?: Array<{
    type: 'medication' | 'symptom' | 'vital' | 'condition';
    text: string;
    value?: string;
    unit?: string;
  }>;
  isPartial?: boolean;
}

interface TranscriptionViewerProps {
  encounterId: string;
  recordingId?: string;
  autoRefresh?: boolean;
}

export function TranscriptionViewer({ encounterId, autoRefresh = false }: TranscriptionViewerProps) {
  const [transcriptions, setTranscriptions] = useState<TranscriptionSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isFirstLoad = true;
    
    const fetchTranscriptions = async () => {
      try {
        const data = await transcriptApi.getTranscripts(encounterId);
        setTranscriptions(data.transcriptions || []);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch transcriptions:', err);
        setError('Failed to load transcriptions');
        // Only show toast on first load error, not on refresh errors
        if (isFirstLoad) {
          toast.error('Failed to load transcriptions');
        }
      } finally {
        setLoading(false);
        isFirstLoad = false;
      }
    };

    fetchTranscriptions();

    // Set up auto-refresh if enabled
    if (autoRefresh) {
      const interval = setInterval(fetchTranscriptions, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [encounterId, autoRefresh]); // Removed loading from dependencies

  const getSpeakerColor = (speaker: string) => {
    switch (speaker.toLowerCase()) {
      case 'doctor':
        return 'bg-blue-100 text-blue-800';
      case 'patient':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getEntityBadgeVariant = (type: string) => {
    switch (type) {
      case 'medication':
        return 'bg-purple-100 text-purple-800';
      case 'symptom':
        return 'bg-red-100 text-red-800';
      case 'vital':
        return 'bg-orange-100 text-orange-800';
      case 'condition':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Transcription
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            Loading transcription...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Transcription
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-500">
            {error}
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
            <FileText className="h-5 w-5" />
            Transcription
          </div>
          {transcriptions.length > 0 && (
            <span className="text-sm font-normal text-gray-500">
              {transcriptions.length} segments
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {transcriptions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No transcription available yet
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto pr-4">
            <div className="space-y-4">
              {transcriptions.map((segment, index) => (
                <div
                  key={`${segment.timestamp}-${index}`}
                  className="border-l-2 border-gray-200 pl-4 py-2 hover:border-gray-400 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant="secondary"
                      className={`text-xs ${getSpeakerColor(segment.speaker)}`}
                    >
                      <User className="h-3 w-3 mr-1" />
                      {segment.speaker}
                    </Badge>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(segment.timestamp), 'HH:mm:ss')}
                    </span>
                    {segment.confidence && (
                      <span className="text-xs text-gray-400">
                        {(segment.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                    {segment.isPartial && (
                      <Badge variant="outline" className="text-xs">
                        Partial
                      </Badge>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {segment.text}
                  </p>
                  
                  {segment.entities && segment.entities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {segment.entities.map((entity, entityIndex) => (
                        <Badge
                          key={`${entity.type}-${entityIndex}`}
                          variant="secondary"
                          className={`text-xs ${getEntityBadgeVariant(entity.type)}`}
                        >
                          {entity.type}: {entity.text}
                          {entity.value && ` (${entity.value}${entity.unit || ''})`}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}