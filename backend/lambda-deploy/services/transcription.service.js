"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.transcriptionService = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client_transcribe_1 = require("@aws-sdk/client-transcribe");
const client_s3_1 = require("@aws-sdk/client-s3");
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
const sdk_1 = require("@deepgram/sdk");
const uuid_1 = require("uuid");
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
const transcribeClient = new client_transcribe_1.TranscribeClient({});
const secretsClient = new client_secrets_manager_1.SecretsManagerClient({});
// DynamoDB-based session storage
const SESSION_TABLE_PREFIX = 'TRANSCRIPTION_SESSION#';
// Deepgram configuration
const DEEPGRAM_SECRET_NAME = process.env.DEEPGRAM_SECRET_NAME || '';
const DEEPGRAM_MEDICAL_MODEL = 'nova-2-medical';
const DEEPGRAM_GENERAL_MODEL = 'nova-2-general'; // Fallback model
const BUFFER_DURATION_MS = 2000; // 2 seconds for more real-time feel
const BUFFER_SIZE_BYTES = 32000; // ~2 seconds at 16kHz
// Cache for Deepgram client to avoid repeated secret fetches
let deepgramClient = null;
let deepgramApiKey = '';
// Map to store active Deepgram live connections
const liveConnections = new Map();
// Map to store WebSocket management clients for sending transcripts
const wsClients = new Map();
class TranscriptionService {
    async transcribeFromS3(params) {
        console.log(`[Transcription] Transcribing from S3: ${params.s3Key}`);
        const s3Client = new client_s3_1.S3Client({});
        try {
            // Get the audio file from S3
            const getObjectResponse = await s3Client.send(new client_s3_1.GetObjectCommand({
                Bucket: process.env.AUDIO_BUCKET_NAME,
                Key: params.s3Key,
            }));
            if (!getObjectResponse.Body) {
                throw new Error('No audio data found in S3');
            }
            // Convert stream to buffer
            const chunks = [];
            for await (const chunk of getObjectResponse.Body) {
                chunks.push(chunk);
            }
            const audioBuffer = Buffer.concat(chunks);
            console.log(`[Transcription] Downloaded audio from S3, size: ${audioBuffer.length} bytes`);
            // Get Deepgram client
            const client = await this.getDeepgramClient();
            if (!client) {
                throw new Error('Deepgram client not available');
            }
            // Transcribe the complete audio file
            const response = await client.listen.prerecorded.transcribeFile(audioBuffer, {
                model: DEEPGRAM_MEDICAL_MODEL,
                punctuate: true,
                diarize: true,
                language: 'en-US',
                smart_format: true,
                utterances: true,
                // Let Deepgram auto-detect the WebM format
                mimetype: 'audio/webm',
            });
            const segments = [];
            if (response.result?.results?.channels?.[0]?.alternatives?.[0]) {
                const alternative = response.result.results.channels[0].alternatives[0];
                if (alternative.transcript && alternative.transcript.trim().length > 0) {
                    // If we have utterances, create segments for each
                    if (response.result.results.utterances && response.result.results.utterances.length > 0) {
                        for (const utterance of response.result.results.utterances) {
                            const segment = {
                                encounterId: params.encounterId,
                                timestamp: Date.now(),
                                text: utterance.transcript,
                                speaker: this.mapSpeakerLabel(utterance.speaker || 0),
                                confidence: utterance.confidence || alternative.confidence,
                                entities: this.extractMedicalEntities(utterance.transcript),
                                isPartial: false,
                            };
                            segments.push(segment);
                            await this.saveTranscriptionSegment(segment);
                            // Send to WebSocket client
                            // TODO: Implement WebSocket notification
                        }
                    }
                    else {
                        // Single segment for the whole transcript
                        const segment = {
                            encounterId: params.encounterId,
                            timestamp: Date.now(),
                            text: alternative.transcript,
                            speaker: 'Unknown',
                            confidence: alternative.confidence,
                            entities: this.extractMedicalEntities(alternative.transcript),
                            isPartial: false,
                        };
                        segments.push(segment);
                        await this.saveTranscriptionSegment(segment);
                    }
                }
            }
            // Clean up the transcription session
            await this.stopTranscription({ sessionId: params.sessionId });
            return {
                transcriptCount: segments.length,
                segments,
            };
        }
        catch (error) {
            console.error('[Transcription] Error transcribing from S3:', error);
            throw error;
        }
    }
    async getDeepgramClient() {
        if (!deepgramClient && DEEPGRAM_SECRET_NAME) {
            try {
                console.log(`[Deepgram] Loading API key from secret: ${DEEPGRAM_SECRET_NAME}`);
                const secretResponse = await secretsClient.send(new client_secrets_manager_1.GetSecretValueCommand({
                    SecretId: DEEPGRAM_SECRET_NAME,
                }));
                if (secretResponse.SecretString) {
                    deepgramApiKey = secretResponse.SecretString;
                    console.log(`[Deepgram] API key loaded successfully`);
                    deepgramClient = (0, sdk_1.createClient)(deepgramApiKey);
                }
                else {
                    console.warn(`[Deepgram] Secret ${DEEPGRAM_SECRET_NAME} has no value`);
                }
            }
            catch (error) {
                console.error(`[Deepgram] Failed to load API key from secret:`, error);
            }
        }
        return deepgramClient;
    }
    async saveSession(session) {
        const item = {
            pk: `${SESSION_TABLE_PREFIX}${session.sessionId}`,
            sk: 'SESSION',
            ...session,
            // Convert buffer array to base64 strings for DynamoDB storage
            audioBuffer: session.audioBuffer.map(buf => buf.toString('base64')),
            ttl: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours TTL
        };
        await docClient.send(new lib_dynamodb_1.PutCommand({
            TableName: process.env.TABLE_NAME,
            Item: item,
        }));
    }
    async getSession(sessionId) {
        const result = await docClient.send(new lib_dynamodb_1.GetCommand({
            TableName: process.env.TABLE_NAME,
            Key: {
                pk: `${SESSION_TABLE_PREFIX}${sessionId}`,
                sk: 'SESSION',
            },
        }));
        if (!result.Item) {
            return null;
        }
        // Convert base64 strings back to buffers
        const session = {
            ...result.Item,
            audioBuffer: (result.Item.audioBuffer || []).map((base64) => Buffer.from(base64, 'base64')),
        };
        return session;
    }
    async deleteSession(sessionId) {
        await docClient.send(new lib_dynamodb_1.DeleteCommand({
            TableName: process.env.TABLE_NAME,
            Key: {
                pk: `${SESSION_TABLE_PREFIX}${sessionId}`,
                sk: 'SESSION',
            },
        }));
    }
    async startTranscription(params) {
        const sessionId = (0, uuid_1.v4)();
        const session = {
            sessionId,
            connectionId: params.connectionId,
            encounterId: params.encounterId,
            startTime: Date.now(),
            status: 'active',
            provider: 'deepgram',
            audioBuffer: [],
            bufferSize: 0,
            lastProcessedTime: Date.now(),
        };
        console.log(`[Transcription] Starting session ${sessionId} for encounter ${params.encounterId}`);
        // Initialize Deepgram live connection
        try {
            const client = await this.getDeepgramClient();
            if (!client) {
                throw new Error('Deepgram client not available');
            }
            // Create live transcription connection
            const connection = client.listen.live({
                model: DEEPGRAM_MEDICAL_MODEL,
                punctuate: true,
                interim_results: true,
                diarize: true,
                language: 'en-US',
                encoding: 'opus', // Changed from linear16 to opus
                sample_rate: 16000,
                channels: 1,
                endpointing: 300,
                utterance_end_ms: 1000,
                vad_events: true,
                smart_format: true,
            });
            // Set up event handlers
            connection.on('open', () => {
                console.log(`[Deepgram] Live connection opened for session ${sessionId}`);
            });
            connection.on('error', (error) => {
                console.error(`[Deepgram] Live connection error for session ${sessionId}:`, error);
            });
            connection.on('close', () => {
                console.log(`[Deepgram] Live connection closed for session ${sessionId}`);
                liveConnections.delete(sessionId);
            });
            connection.on('transcript.partial', (data) => {
                this.handleTranscriptEvent(session, data, true);
            });
            connection.on('transcript', (data) => {
                this.handleTranscriptEvent(session, data, false);
            });
            connection.on('utterance_end', (data) => {
                console.log(`[Deepgram] Utterance end for session ${sessionId}`);
            });
            // Store the connection
            liveConnections.set(sessionId, connection);
            // Store WebSocket client info if provided
            if (params.apiGatewayClient) {
                wsClients.set(sessionId, {
                    connectionId: params.connectionId,
                    apiGatewayClient: params.apiGatewayClient
                });
            }
        }
        catch (error) {
            console.error(`[Transcription] Failed to create Deepgram live connection:`, error);
            // Continue without live transcription - will fall back to batch processing
        }
        await this.saveSession(session);
        return session;
    }
    async processAudioChunk(params) {
        const session = await this.getSession(params.sessionId);
        if (!session) {
            throw new Error(`Transcription session ${params.sessionId} not found`);
        }
        if (session.status !== 'active') {
            throw new Error(`Transcription session ${params.sessionId} is not active`);
        }
        // Get the live connection
        const connection = liveConnections.get(params.sessionId);
        if (connection && connection.getReadyState() === 1) {
            // Send audio directly to Deepgram live connection
            try {
                // Decode base64 audio chunk
                const audioBuffer = Buffer.from(params.chunk, 'base64');
                // For live streaming, we need to convert WebM/Opus to PCM
                // This is a simplified approach - in production you'd use a proper audio decoder
                // For now, we'll just send the raw data and let Deepgram handle it
                connection.send(audioBuffer);
                // No immediate return - transcripts come through event handlers
                return null;
            }
            catch (error) {
                console.error(`[Transcription] Error sending to live connection:`, error);
            }
        }
        // Fallback to buffering for batch processing
        const audioBuffer = Buffer.from(params.chunk, 'base64');
        session.audioBuffer.push(audioBuffer);
        session.bufferSize += audioBuffer.length;
        // Check if we've buffered enough audio
        const shouldProcess = session.bufferSize >= BUFFER_SIZE_BYTES ||
            Date.now() - session.lastProcessedTime >= BUFFER_DURATION_MS;
        if (!shouldProcess) {
            // Save updated session back to DynamoDB
            await this.saveSession(session);
            return null; // Continue buffering
        }
        console.log(`[Transcription] Processing buffered audio - ${session.audioBuffer.length} chunks, ${session.bufferSize} bytes`);
        // Combine buffered audio
        const combinedBuffer = Buffer.concat(session.audioBuffer);
        session.audioBuffer = [];
        session.bufferSize = 0;
        session.lastProcessedTime = Date.now();
        // Save updated session back to DynamoDB
        await this.saveSession(session);
        try {
            // Try Deepgram first
            const segment = await this.transcribeWithDeepgram(session, combinedBuffer);
            if (segment) {
                await this.saveTranscriptionSegment(segment);
                return segment;
            }
        }
        catch (error) {
            console.error('[Transcription] Deepgram failed:', error);
        }
        return null;
    }
    async transcribeWithDeepgram(session, audioBuffer) {
        const client = await this.getDeepgramClient();
        if (!client) {
            console.warn('[Deepgram] Client not initialized - API key missing');
            return null;
        }
        try {
            let response;
            let modelUsed = DEEPGRAM_MEDICAL_MODEL;
            try {
                console.log(`[Deepgram] Attempting transcription with medical model: ${DEEPGRAM_MEDICAL_MODEL}`);
                response = await client.listen.prerecorded.transcribeFile(audioBuffer, {
                    model: DEEPGRAM_MEDICAL_MODEL,
                    punctuate: true,
                    diarize: true,
                    language: 'en-US',
                    smart_format: true,
                    utterances: true,
                    encoding: 'webm-opus',
                    sample_rate: 16000,
                    channels: 1,
                    vad_events: true,
                    interim_results: false,
                    endpointing: false,
                    keywords: ['pain:2', 'medication:2', 'treatment:2', 'doctor:3', 'patient:3'],
                    detect_language: false,
                });
            }
            catch (medicalModelError) {
                console.warn(`[Deepgram] Medical model failed, trying general model:`, medicalModelError);
                modelUsed = DEEPGRAM_GENERAL_MODEL;
                response = await client.listen.prerecorded.transcribeFile(audioBuffer, {
                    model: DEEPGRAM_GENERAL_MODEL,
                    punctuate: true,
                    diarize: true,
                    language: 'en-US',
                    smart_format: true,
                    utterances: true,
                    encoding: 'webm-opus',
                    sample_rate: 16000,
                    channels: 1,
                    vad_events: true,
                    interim_results: false,
                    endpointing: false,
                    detect_language: false,
                });
            }
            console.log(`[Deepgram] Transcription completed using model: ${modelUsed}`);
            const result = response.result;
            if (result?.results?.channels?.[0]?.alternatives?.[0]) {
                const alternative = result.results.channels[0].alternatives[0];
                const words = alternative.words || [];
                // Check if transcript is empty
                if (!alternative.transcript || alternative.transcript.trim().length === 0) {
                    console.warn(`[Deepgram] Empty transcript detected`);
                    return null;
                }
                // Extract speaker labels from diarization
                let speaker = 'Unknown';
                if (words.length > 0 && words[0].speaker !== undefined) {
                    speaker = this.identifySpeaker(words, alternative.transcript, session);
                }
                const segment = {
                    encounterId: session.encounterId,
                    timestamp: Date.now(),
                    text: alternative.transcript,
                    speaker,
                    confidence: alternative.confidence,
                    entities: this.extractMedicalEntities(alternative.transcript),
                    isPartial: false,
                };
                return segment;
            }
            else {
                console.warn(`[Deepgram] No valid alternatives found in response`);
            }
        }
        catch (error) {
            console.error('[Deepgram] Transcription error:', error);
            throw error;
        }
        return null;
    }
    mapSpeakerLabel(speakerId) {
        const speakerMap = {
            0: 'Doctor',
            1: 'Patient',
        };
        return speakerMap[speakerId] || 'Other';
    }
    identifySpeaker(words, transcript, session) {
        if (!words || words.length === 0)
            return 'Unknown';
        const firstSpeakerId = words[0].speaker;
        // Content-based speaker identification patterns
        const doctorPatterns = [
            /\b(how are you feeling|what brings you in|let me examine|I'd like to|prescription|diagnosis|treatment|medication|mg|take this|follow up)\b/i,
            /\b(blood pressure|heart rate|temperature|breathing|pulse|examination|symptoms|condition)\b/i,
            /\b(I recommend|let's try|you should|take twice daily|come back in|schedule)\b/i
        ];
        const patientPatterns = [
            /\b(I feel|I have|I've been|my|it hurts|pain in|since yesterday|for weeks|I can't)\b/i,
            /\b(yes doctor|no doctor|thank you|okay|alright|I understand|when should I)\b/i,
            /\b(it started|I noticed|I'm experiencing|I think|I believe|I'm worried)\b/i
        ];
        // Check content patterns
        const isDoctorContent = doctorPatterns.some(pattern => pattern.test(transcript));
        const isPatientContent = patientPatterns.some(pattern => pattern.test(transcript));
        if (isDoctorContent && !isPatientContent) {
            return 'Doctor';
        }
        else if (isPatientContent && !isDoctorContent) {
            return 'Patient';
        }
        else {
            // Fall back to diarization mapping
            return this.mapSpeakerLabel(firstSpeakerId);
        }
    }
    extractMedicalEntities(text) {
        const entities = [];
        // Medication patterns
        const medicationRegex = /(\b\w+(?:azole|cillin|mycin|statin|pril|sartan|olol|azepam|epine|ine|one|ide)\b)\s*(?:(\d+)\s*(mg|mcg|g|ml|units?))?/gi;
        let match;
        while ((match = medicationRegex.exec(text)) !== null) {
            entities.push({
                type: 'medication',
                text: match[0],
                value: match[2],
                unit: match[3],
                attributes: {
                    name: match[1],
                    dose: match[2],
                    unit: match[3],
                },
            });
        }
        // Vital signs patterns
        const vitalsRegex = /(?:blood pressure|bp|temperature|temp|pulse|heart rate|respiratory rate|oxygen|o2|spo2)\s*(?:is|of|:)?\s*(\d+(?:\/\d+)?)\s*(\/|\w+)?/gi;
        while ((match = vitalsRegex.exec(text)) !== null) {
            entities.push({
                type: 'vital',
                text: match[0],
                value: match[1],
                unit: match[2],
            });
        }
        // Common symptoms
        const symptomKeywords = ['pain', 'ache', 'fever', 'cough', 'fatigue', 'nausea', 'dizziness', 'shortness of breath'];
        symptomKeywords.forEach(symptom => {
            const regex = new RegExp(`\\b${symptom}\\b`, 'gi');
            if (regex.test(text)) {
                entities.push({
                    type: 'symptom',
                    text: symptom,
                });
            }
        });
        return entities;
    }
    async saveTranscriptionSegment(segment) {
        const timestampStr = segment.timestamp.toString();
        const item = {
            pk: `ENCOUNTER#${segment.encounterId}`,
            sk: `TRANSCRIPT#${timestampStr}`,
            gsi1pk: `ENCOUNTER#${segment.encounterId}`,
            gsi1sk: `TRANSCRIPT#${timestampStr}`,
            ...segment,
            timestamp: timestampStr, // Ensure timestamp is string for DynamoDB GSI
            ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60), // 90 days
        };
        console.log(`[Transcription] Saving segment - text: "${segment.text.substring(0, 50)}..."`);
        await docClient.send(new lib_dynamodb_1.PutCommand({
            TableName: process.env.TABLE_NAME,
            Item: item,
        }));
    }
    async stopTranscription(params) {
        console.log(`[Transcription] Stopping session ${params.sessionId}`);
        const session = await this.getSession(params.sessionId);
        if (!session) {
            throw new Error('Transcription session not found');
        }
        // Close live connection if exists
        const connection = liveConnections.get(params.sessionId);
        if (connection) {
            try {
                connection.finish();
                liveConnections.delete(params.sessionId);
                wsClients.delete(params.sessionId);
                console.log(`[Transcription] Closed live connection for session ${params.sessionId}`);
            }
            catch (error) {
                console.error(`[Transcription] Error closing live connection:`, error);
            }
        }
        // Process any remaining buffered audio
        if (session.audioBuffer.length > 0) {
            const combinedBuffer = Buffer.concat(session.audioBuffer);
            try {
                const segment = await this.transcribeWithDeepgram(session, combinedBuffer);
                if (segment) {
                    await this.saveTranscriptionSegment(segment);
                }
            }
            catch (error) {
                console.error('[Transcription] Failed to process final buffer:', error);
            }
        }
        session.status = 'completed';
        session.endTime = Date.now();
        // Create recording metadata for this transcription session
        let recordingId;
        try {
            console.log(`[Transcription] Creating recording metadata for session ${params.sessionId}, encounter ${session.encounterId}`);
            recordingId = await this.createRecordingFromTranscription(session);
            console.log(`[Transcription] Successfully created recording ${recordingId} for transcription session ${params.sessionId}`);
        }
        catch (error) {
            console.error(`[Transcription] CRITICAL: Failed to create recording for session ${params.sessionId}:`, error);
        }
        // Delete session
        await this.deleteSession(params.sessionId);
        // Count total transcript segments
        const result = await docClient.send(new lib_dynamodb_1.QueryCommand({
            TableName: process.env.TABLE_NAME,
            KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
            ExpressionAttributeValues: {
                ':pk': `ENCOUNTER#${session.encounterId}`,
                ':sk': 'TRANSCRIPT#',
            },
            Select: 'COUNT',
        }));
        return {
            transcriptCount: result.Count || 0,
            recordingId
        };
    }
    async createRecordingFromTranscription(session) {
        console.log(`[createRecordingFromTranscription] Starting for session ${session.sessionId}, encounter ${session.encounterId}`);
        const recordingId = (0, uuid_1.v4)();
        const startTime = new Date(session.startTime).toISOString();
        const endTime = new Date(session.endTime || Date.now()).toISOString();
        const duration = (session.endTime || Date.now()) - session.startTime;
        const recording = {
            id: recordingId,
            startTime,
            endTime,
            duration,
            s3Key: `transcription-recordings/${session.encounterId}/${recordingId}.webm`,
            transcriptionId: session.sessionId,
            type: 'transcription-only',
        };
        console.log(`[createRecordingFromTranscription] Created recording object:`, recording);
        // Get the current encounter
        const currentEncounter = await docClient.send(new lib_dynamodb_1.GetCommand({
            TableName: process.env.TABLE_NAME,
            Key: {
                pk: `ENCOUNTER#${session.encounterId}`,
                sk: 'METADATA',
            }
        }));
        if (!currentEncounter.Item) {
            console.error(`[createRecordingFromTranscription] Encounter ${session.encounterId} not found`);
            throw new Error(`Encounter ${session.encounterId} not found`);
        }
        // Add recording to encounter
        const existingRecordings = currentEncounter.Item.recordings || [];
        const updatedRecordings = [...existingRecordings, recording];
        console.log(`[createRecordingFromTranscription] Updating encounter with new recording`, {
            existingCount: existingRecordings.length,
            newCount: updatedRecordings.length
        });
        await docClient.send(new lib_dynamodb_1.UpdateCommand({
            TableName: process.env.TABLE_NAME,
            Key: {
                pk: `ENCOUNTER#${session.encounterId}`,
                sk: 'METADATA',
            },
            UpdateExpression: 'SET recordings = :recordings',
            ExpressionAttributeValues: {
                ':recordings': updatedRecordings,
            },
        }));
        console.log(`[createRecordingFromTranscription] Successfully updated encounter ${session.encounterId} with recording ${recordingId}`);
        return recordingId;
    }
    async getTranscriptionSegments(encounterId, limit = 100) {
        const result = await docClient.send(new lib_dynamodb_1.QueryCommand({
            TableName: process.env.TABLE_NAME,
            KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
            ExpressionAttributeValues: {
                ':pk': `ENCOUNTER#${encounterId}`,
                ':sk': 'TRANSCRIPT#',
            },
            Limit: limit,
            ScanIndexForward: true, // Chronological order
        }));
        return (result.Items || []);
    }
    async handleTranscriptEvent(session, data, isPartial) {
        try {
            if (!data.channel || !data.channel.alternatives || data.channel.alternatives.length === 0) {
                return;
            }
            const alternative = data.channel.alternatives[0];
            if (!alternative.transcript || alternative.transcript.trim().length === 0) {
                return;
            }
            // Extract speaker information
            let speaker = 'Unknown';
            if (data.channel.alternatives[0].words && data.channel.alternatives[0].words.length > 0) {
                const speakerId = data.channel.alternatives[0].words[0].speaker;
                speaker = this.mapSpeakerLabel(speakerId);
            }
            const segment = {
                encounterId: session.encounterId,
                timestamp: Date.now(),
                text: alternative.transcript,
                speaker,
                confidence: alternative.confidence,
                entities: this.extractMedicalEntities(alternative.transcript),
                isPartial,
            };
            // Save the segment if it's final
            if (!isPartial) {
                await this.saveTranscriptionSegment(segment);
            }
            // Send to WebSocket client
            const wsClient = wsClients.get(session.sessionId);
            if (wsClient && wsClient.apiGatewayClient) {
                try {
                    const { PostToConnectionCommand } = await Promise.resolve().then(() => __importStar(require('@aws-sdk/client-apigatewaymanagementapi')));
                    await wsClient.apiGatewayClient.send(new PostToConnectionCommand({
                        ConnectionId: wsClient.connectionId,
                        Data: JSON.stringify({
                            type: 'transcript',
                            segment,
                            sessionId: session.sessionId,
                            isPartial,
                        }),
                    }));
                }
                catch (wsError) {
                    console.error(`[Transcription] Error sending transcript to WebSocket:`, wsError);
                }
            }
            console.log(`[Transcription] ${isPartial ? 'Partial' : 'Final'} transcript:`, segment.text);
        }
        catch (error) {
            console.error(`[Transcription] Error handling transcript event:`, error);
        }
    }
}
exports.transcriptionService = new TranscriptionService();
//# sourceMappingURL=transcription.service.js.map