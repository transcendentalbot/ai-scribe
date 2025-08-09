# Audio Recording Context

## Requirements
- Manual start/stop recording (no ambient)
- Consent checkbox must be checked first
- Real-time audio quality monitoring
- Visual + text indicators for recording status
- Auto-stop at 30 minutes
- Pause/resume functionality

## Audio Specifications
- 16kHz sample rate, mono channel
- WebM format with Opus codec
- 1-second chunks via WebSocket
- Maximum file size: 100MB

## Quality Monitoring
- Volume level indicator (green/yellow/red)
- Background noise detection
- "Audio too low" warning message
- "High background noise" alert
- Lost connection notification

## Error Scenarios
- Microphone permission denied
- Microphone disconnected mid-recording
- Network connection lost
- WebSocket connection failed
- Browser doesn't support recording

## S3 Storage
- Bucket: ai-scribe-audio-{environment}
- 24-hour lifecycle policy
- Server-side encryption
- Pre-signed URLs for upload

**Cursor Prompt**:
```
Implement audio recording system:
1. React component with record button and consent checkbox
2. Web Audio API setup with quality monitoring
3. WebSocket client for streaming audio chunks
4. Lambda WebSocket handler for audio reception
5. S3 upload with pre-signed URLs
6. Real-time quality indicators and warnings

Include comprehensive error handling and user notifications.
```