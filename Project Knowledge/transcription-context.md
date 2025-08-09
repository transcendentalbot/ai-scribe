# Transcription Service Context

## Requirements
- Real-time transcription via WebSocket
- Deepgram primary, AssemblyAI fallback
- Speaker labels: Doctor, Patient, Other
- Medical terminology accuracy
- Highlight medications and dosages

## Processing Flow
1. Receive 1-second audio chunks
2. Buffer to 5-second segments
3. Send to Deepgram with medical model
4. If Deepgram fails, queue for AssemblyAI
5. Parse response for medical entities
6. Send results back via WebSocket

## Entity Extraction
- Medications: name, dose, route, frequency
- Symptoms with descriptors
- Vital signs with values
- Medical conditions mentioned

## Failure Handling
- If transcription fails completely:
  - Save audio reference in DynamoDB
  - Send email notification to provider
  - Show "Transcription Failed" in UI
  - 24-hour countdown before audio deletion
  - Option to download audio

## Storage
- PK: ENCOUNTER#{encounterId}
- SK: TRANSCRIPT#{timestamp}
- Attributes: text, speaker, confidence, entities

**Cursor Prompt**:
```
Create transcription service:
1. Lambda function for WebSocket audio processing
2. Deepgram integration with medical model
3. AssemblyAI fallback implementation
4. Medical entity extraction with regex
5. DynamoDB storage of transcript segments
6. Failure notification system with email alerts

Handle API rate limits and ensure no data loss.
```