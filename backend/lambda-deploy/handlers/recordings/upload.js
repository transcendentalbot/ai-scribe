"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const response_1 = require("../../utils/response");
const jwt_1 = require("../../utils/jwt");
const uuid_1 = require("uuid");
const s3Client = new client_s3_1.S3Client({ region: process.env.AWS_REGION });
const BUCKET_NAME = process.env.RECORDINGS_BUCKET || 'ai-scribe-recordings';
const handler = async (event) => {
    try {
        // Get user from token (API Gateway has already verified it)
        const user = (0, jwt_1.getUserFromToken)(event);
        // For now, return a presigned URL for direct upload
        const body = JSON.parse(event.body || '{}');
        const { encounterId, filename } = body;
        if (!encounterId || !filename) {
            return response_1.response.error('Missing encounterId or filename', 400);
        }
        // Create S3 key
        const recordingId = (0, uuid_1.v4)();
        const s3Key = `recordings/${encounterId}/${recordingId}/${filename}`;
        // Generate presigned URL for PUT
        const command = new client_s3_1.PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key,
            ContentType: 'audio/webm',
        });
        const presignedUrl = await (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, { expiresIn: 3600 });
        return response_1.response.success({
            presignedUrl,
            s3Key,
            recordingId,
        });
    }
    catch (error) {
        console.error('Upload error:', error);
        return response_1.response.error('Failed to generate upload URL', 500);
    }
};
exports.handler = handler;
//# sourceMappingURL=upload.js.map