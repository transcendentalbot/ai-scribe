import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { transcriptionService } from '../../services/transcription.service';
import { response } from '../../utils/response';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const encounterId = event.pathParameters?.encounterId;
    
    if (!encounterId) {
      return response.error('Encounter ID is required', 400);
    }

    console.log(`[get-transcripts] Fetching transcripts for encounter: ${encounterId}`);

    const segments = await transcriptionService.getTranscriptionSegments(encounterId);
    
    console.log(`[get-transcripts] Found ${segments.length} transcript segments`);

    return response.success({
      transcripts: segments,
      count: segments.length,
    });
  } catch (error) {
    console.error('[get-transcripts] Error:', error);
    return response.error('Failed to fetch transcripts', 500);
  }
};