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
- Multipart upload for large files

## Implementation Status (Updated: 2025-08-12)

### Completed
1. ✅ **WebSocket Infrastructure**
   - WebSocket API Gateway configured
   - Connect/disconnect handlers implemented
   - Audio stream route established

2. ✅ **Session Management**
   - Fixed DynamoDB session storage (using connectionId as key)
   - Sessions properly stored and retrieved
   - Session lifecycle management working

3. ✅ **Frontend Recording**
   - WebSocket recording hook implemented
   - Debug recording component for testing
   - Simple recording with S3 upload as fallback
   - Audio chunks sent successfully to backend

4. ✅ **Backend Processing**
   - Audio chunks received and acknowledged
   - S3 multipart upload initialized
   - Session tracking across Lambda instances

### Current Issues
1. ✅ **S3 Multipart Upload Requirements** (FIXED)
   - ~~Error: `EntityTooSmall: Your proposed upload is smaller than the minimum allowed size`~~
   - ~~S3 requires minimum 5MB per part (except last part)~~
   - ~~Current chunks are only ~8KB each~~
   - ✅ Implemented chunk buffering until 5MB threshold
   - ✅ Added in-memory buffer storage for Lambda instances
   - ✅ Final part can be < 5MB on stop recording

### Next Steps
1. **Test Recording Flow**
   - Test end-to-end recording with new buffering logic
   - Verify recordings are properly saved to S3
   - Test with recordings of various lengths

2. **Complete Recording Flow**
   - Test end-to-end recording with buffering
   - Verify recordings saved to encounter
   - Implement recording playback

3. **Add Missing Features**
   - Audio quality monitoring
   - Visual indicators
   - Pause/resume functionality
   - Auto-stop at 30 minutes

**Cursor Prompt**:
```
Fix S3 multipart upload in audio service:
1. Buffer audio chunks until reaching 5MB threshold
2. Upload buffered chunks as S3 multipart parts
3. Handle last part (can be < 5MB)
4. Update session in DynamoDB after each part upload
5. Complete multipart upload on stop recording

Key constraint: S3 multipart requires minimum 5MB per part except the last one.
```