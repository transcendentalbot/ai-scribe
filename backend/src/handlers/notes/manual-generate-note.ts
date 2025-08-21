import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { errorHandler } from '../../middleware/error-handler';
import { validatePathParams } from '../../middleware/request-validator';
import { getUserFromToken } from '../../utils/jwt';
import { response } from '../../utils/response';
import { logger } from '../../utils/logger';
import { publishTranscriptionCompletedEvent } from '../../services/event.service';
import { ValidationError } from '../../errors';
import { z } from 'zod';

const PathParamsSchema = z.object({
  encounterId: z.string().uuid(),
});

const manualGenerateNoteHandler = async (event: APIGatewayProxyEvent, context: Context) => {
  const startTime = Date.now();
  const requestId = context.awsRequestId;

  logger.info('[Manual Generate Note] Handler started', {
    requestId,
    path: event.path,
    method: event.httpMethod,
  });

  // Validate path parameters
  const { encounterId } = validatePathParams(event, PathParamsSchema);

  // Get user from token
  const { userId: providerId } = getUserFromToken(event);

  try {
    // For manual note generation, we simulate a transcription completion event
    // This triggers the same note generation flow as automatic generation
    
    logger.info('[Manual Generate Note] Publishing manual transcription event', {
      encounterId,
      providerId,
      requestId,
    });

    // Publish the transcription completed event to trigger note generation
    await publishTranscriptionCompletedEvent({
      encounterId,
      recordingId: `manual-${Date.now()}`, // Placeholder recording ID
      transcriptCount: 1, // Assume we have transcripts
      providerId,
      completedAt: new Date().toISOString(),
      requestId,
      metadata: {
        triggerSource: 'manual-generation',
        initiatedBy: providerId,
      },
    });

    const duration = Date.now() - startTime;
    logger.info('[Manual Generate Note] Manual note generation triggered', {
      encounterId,
      providerId,
      duration,
      requestId,
    });

    return response.success({
      message: 'Note generation started',
      encounterId,
      status: 'PROCESSING',
      estimatedTime: '10-30 seconds',
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('[Manual Generate Note] Failed to trigger note generation', {
      encounterId,
      providerId,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      requestId,
    });
    throw error;
  }
};

export const handler = errorHandler(manualGenerateNoteHandler);