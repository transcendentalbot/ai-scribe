"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const transcription_service_1 = require("../../services/transcription.service");
const response_1 = require("../../utils/response");
const handler = async (event) => {
    try {
        const encounterId = event.pathParameters?.encounterId;
        if (!encounterId) {
            return response_1.response.error('Encounter ID is required', 400);
        }
        console.log(`[get-transcripts] Fetching transcripts for encounter: ${encounterId}`);
        const segments = await transcription_service_1.transcriptionService.getTranscriptionSegments(encounterId);
        console.log(`[get-transcripts] Found ${segments.length} transcript segments`);
        return response_1.response.success({
            transcripts: segments,
            count: segments.length,
        });
    }
    catch (error) {
        console.error('[get-transcripts] Error:', error);
        return response_1.response.error('Failed to fetch transcripts', 500);
    }
};
exports.handler = handler;
//# sourceMappingURL=get-transcripts.js.map