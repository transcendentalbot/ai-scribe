# Error Handling Context

## User-Facing Messages
- Microphone not detected: "Please check your microphone connection"
- Low audio: "Please speak louder or move closer to the microphone"
- High noise: "High background noise detected - recording quality may be affected"
- Connection lost: "Connection lost. Attempting to reconnect..."
- Transcription failed: "Transcription service temporarily unavailable"
- Note generation failed: "Unable to generate note. Please try again."

## System Notifications
- Email provider if transcription fails
- 24-hour warning before audio deletion
- Session timeout warning at 25 minutes
- Successfully saved indicator
- Sync status for offline capability

## Error Recovery
- Auto-retry with exponential backoff
- Queue failed operations
- Preserve user input during errors
- Graceful degradation
- Offline mode with sync

## Logging
- Structured logs with request IDs
- No PHI in error messages
- Stack traces in development only
- User-friendly messages in production

**Cursor Prompt**:
```
Implement comprehensive error handling:
1. Global error boundary for React
2. API error interceptor with retry logic
3. User notification system (toasts)
4. Email alerts for critical failures
5. Offline queue for failed requests
6. Status indicators throughout UI

Ensure all errors are handled gracefully with clear user feedback.
```