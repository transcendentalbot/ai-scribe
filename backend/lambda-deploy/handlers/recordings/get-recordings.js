"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const response_1 = require("../../utils/response");
const jwt_1 = require("../../utils/jwt");
const s3Client = new client_s3_1.S3Client({});
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
const handler = async (event) => {
    try {
        // Verify authorization
        const user = (0, jwt_1.getUserFromToken)(event);
        const encounterId = event.pathParameters?.encounterId;
        if (!encounterId) {
            return response_1.response.error('Encounter ID is required', 400);
        }
        // Query encounter metadata to get recordings
        const encounterResult = await docClient.send(new lib_dynamodb_1.QueryCommand({
            TableName: process.env.TABLE_NAME,
            KeyConditionExpression: 'pk = :pk AND sk = :sk',
            ExpressionAttributeValues: {
                ':pk': `ENCOUNTER#${encounterId}`,
                ':sk': 'METADATA',
            },
        }));
        if (!encounterResult.Items || encounterResult.Items.length === 0) {
            return response_1.response.error('Encounter not found', 404);
        }
        const encounter = encounterResult.Items[0];
        const recordings = encounter.recordings || [];
        // Generate presigned URLs for each recording
        const recordingsWithUrls = await Promise.all(recordings.map(async (recording) => {
            try {
                // Generate presigned URL for download/playback
                const presignedUrl = await (0, s3_request_presigner_1.getSignedUrl)(s3Client, new client_s3_1.GetObjectCommand({
                    Bucket: process.env.AUDIO_BUCKET_NAME,
                    Key: recording.s3Key,
                }), { expiresIn: 3600 } // 1 hour expiration
                );
                return {
                    ...recording,
                    url: presignedUrl,
                };
            }
            catch (error) {
                console.error(`Failed to generate URL for recording ${recording.id}:`, error);
                return {
                    ...recording,
                    url: null,
                    error: 'Failed to generate download URL',
                };
            }
        }));
        return response_1.response.success({
            encounterId,
            recordings: recordingsWithUrls,
        });
    }
    catch (error) {
        console.error('Error retrieving recordings:', error);
        return response_1.response.error('Internal server error', 500);
    }
};
exports.handler = handler;
//# sourceMappingURL=get-recordings.js.map