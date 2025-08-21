import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { logger } from '../utils/logger';

const eventBridge = new EventBridgeClient({});

interface TranscriptionCompletedEventData {
  encounterId: string;
  recordingId: string;
  transcriptCount: number;
  providerId: string;
  completedAt: string;
  requestId: string;
  duration?: number;
  metadata?: any;
}

interface NoteGenerationCompletedEventData {
  encounterId: string;
  noteId: string;
  providerId: string;
  status: 'DRAFT' | 'ERROR';
  generatedAt: string;
  processingTimeMs: number;
  requestId: string;
}

/**
 * Publish transcription completed event to trigger note generation
 * Used by WebSocket audio stream handler
 */
export async function publishTranscriptionCompletedEvent(
  data: TranscriptionCompletedEventData
): Promise<void> {
  try {
    const event = {
      Source: 'ai-scribe.transcription',
      DetailType: 'Transcription Completed',
      Detail: JSON.stringify({
        encounterId: data.encounterId,
        recordingId: data.recordingId,
        transcriptCount: data.transcriptCount,
        providerId: data.providerId,
        completedAt: data.completedAt,
        duration: data.duration,
        metadata: {
          requestId: data.requestId,
          triggerSource: 'websocket-stop-recording',
          ...data.metadata,
        },
      }),
      EventBusName: process.env.EVENT_BUS_NAME,
    };

    logger.info('[Event] Publishing transcription completed event', {
      encounterId: data.encounterId,
      recordingId: data.recordingId,
      transcriptCount: data.transcriptCount,
      requestId: data.requestId,
    });

    await eventBridge.send(new PutEventsCommand({
      Entries: [event],
    }));

    logger.info('[Event] Transcription completed event published successfully', {
      encounterId: data.encounterId,
      requestId: data.requestId,
    });

  } catch (error) {
    logger.error('[Event] Failed to publish transcription completed event', {
      error: error instanceof Error ? error.message : 'Unknown error',
      encounterId: data.encounterId,
      requestId: data.requestId,
    });
    
    // Don't throw - we don't want to fail the recording completion
    // The event will be retried or handled by monitoring
  }
}

/**
 * Publish note generation completed event
 * Used by note generation handler for downstream processing
 */
export async function publishNoteGenerationCompletedEvent(
  data: NoteGenerationCompletedEventData
): Promise<void> {
  try {
    const event = {
      Source: 'ai-scribe.notes',
      DetailType: 'Note Generation Completed',
      Detail: JSON.stringify({
        encounterId: data.encounterId,
        noteId: data.noteId,
        providerId: data.providerId,
        status: data.status,
        generatedAt: data.generatedAt,
        processingTimeMs: data.processingTimeMs,
        metadata: {
          requestId: data.requestId,
          triggerSource: 'note-generation-handler',
        },
      }),
      EventBusName: process.env.EVENT_BUS_NAME,
    };

    logger.info('[Event] Publishing note generation completed event', {
      encounterId: data.encounterId,
      noteId: data.noteId,
      status: data.status,
      requestId: data.requestId,
    });

    await eventBridge.send(new PutEventsCommand({
      Entries: [event],
    }));

    logger.info('[Event] Note generation completed event published successfully', {
      encounterId: data.encounterId,
      noteId: data.noteId,
      requestId: data.requestId,
    });

  } catch (error) {
    logger.error('[Event] Failed to publish note generation completed event', {
      error: error instanceof Error ? error.message : 'Unknown error',
      encounterId: data.encounterId,
      noteId: data.noteId,
      requestId: data.requestId,
    });
    
    // Don't throw - log the error but continue
  }
}

/**
 * Publish generic AI Scribe event
 * Can be used for other event types in the future
 */
export async function publishEvent(
  source: string,
  detailType: string,
  detail: any,
  requestId?: string
): Promise<void> {
  try {
    const event = {
      Source: source,
      DetailType: detailType,
      Detail: JSON.stringify(detail),
      EventBusName: process.env.EVENT_BUS_NAME,
    };

    logger.info('[Event] Publishing custom event', {
      source,
      detailType,
      requestId,
    });

    await eventBridge.send(new PutEventsCommand({
      Entries: [event],
    }));

    logger.info('[Event] Custom event published successfully', {
      source,
      detailType,
      requestId,
    });

  } catch (error) {
    logger.error('[Event] Failed to publish custom event', {
      error: error instanceof Error ? error.message : 'Unknown error',
      source,
      detailType,
      requestId,
    });
    
    throw error; // Throw for custom events as they may be critical
  }
}