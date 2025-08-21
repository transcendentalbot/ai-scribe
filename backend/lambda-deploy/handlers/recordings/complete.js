"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const response_1 = require("../../utils/response");
const handler = async (event) => {
    try {
        const encounterId = event.pathParameters?.encounterId;
        const body = JSON.parse(event.body || '{}');
        if (!encounterId) {
            return response_1.response.error('Encounter ID is required', 400);
        }
        console.log(`[complete-recording] Completing recording for encounter: ${encounterId}`, body);
        // This endpoint is for completing file-based recordings
        // For now, return success as the logic will be implemented later
        return response_1.response.success({
            message: 'Recording completion endpoint - implementation pending',
            encounterId,
            body,
        });
    }
    catch (error) {
        console.error('[complete-recording] Error:', error);
        return response_1.response.error('Failed to complete recording', 500);
    }
};
exports.handler = handler;
//# sourceMappingURL=complete.js.map