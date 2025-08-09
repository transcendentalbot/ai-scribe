# Module Implementation Handler

This document provides the implementation logic for the /implement-module command.

## Module Context File Mapping

```javascript
const MODULE_MAPPING = {
  'auth': 'auth-context.md',
  'encounters': 'encounter-context.md',
  'audio': 'audio-context.md',
  'transcription': 'transcription-context.md',
  'notes': 'note-generation-context.md',
  'clipboard': 'clipboard-context.md',
  'infrastructure': 'infrastructure-context.md',
  'errors': 'error-handling-context.md'
};
```

## Implementation Steps for Each Module

### 1. Auth Module
- **Backend**: `backend/src/handlers/auth/`
  - `login.ts` - Provider login handler
  - `logout.ts` - Session termination
  - `refresh.ts` - Token refresh
  - `middleware/auth.ts` - JWT validation
- **Frontend**: `frontend/src/`
  - `components/auth/LoginForm.tsx`
  - `contexts/AuthContext.tsx`
  - `hooks/useAuth.ts`
  - `utils/auth.ts`
- **Infrastructure**: `infrastructure/`
  - `tables/users-table.yml`
  - `functions/auth-functions.yml`

### 2. Encounters Module
- **Backend**: `backend/src/handlers/encounters/`
  - `search-patient.ts` - Patient lookup
  - `create-encounter.ts` - New encounter
  - `update-encounter.ts` - Update status
  - `get-encounter.ts` - Retrieve details
- **Frontend**: `frontend/src/`
  - `components/encounters/PatientSearch.tsx`
  - `components/encounters/EncounterForm.tsx`
  - `components/encounters/ConsentCapture.tsx`
- **Infrastructure**: `infrastructure/`
  - `tables/encounters-table.yml`
  - `tables/patients-table.yml`

### 3. Audio Module
- **Backend**: `backend/src/handlers/audio/`
  - `start-recording.ts` - WebSocket connection
  - `process-chunk.ts` - Audio streaming
  - `stop-recording.ts` - Finalize recording
- **Frontend**: `frontend/src/`
  - `components/audio/RecordingControls.tsx`
  - `components/audio/QualityMonitor.tsx`
  - `hooks/useRecording.ts`
  - `utils/audio-stream.ts`

### 4. Transcription Module
- **Backend**: `backend/src/handlers/transcription/`
  - `process-audio.ts` - Real-time transcription
  - `extract-entities.ts` - Medical entity extraction
  - `update-transcript.ts` - Edit capabilities
- **Frontend**: `frontend/src/`
  - `components/transcription/TranscriptDisplay.tsx`
  - `components/transcription/EntityHighlights.tsx`
  - `hooks/useTranscription.ts`

### 5. Notes Module
- **Backend**: `backend/src/handlers/notes/`
  - `generate-note.ts` - GPT-4 SOAP generation
  - `update-note.ts` - Edit note
  - `extract-codes.ts` - ICD-10/CPT extraction
- **Frontend**: `frontend/src/`
  - `components/notes/NoteEditor.tsx`
  - `components/notes/CodeSelector.tsx`
  - `components/notes/NotePreview.tsx`

### 6. Clipboard Module
- **Backend**: `backend/src/handlers/clipboard/`
  - `parse-sections.ts` - Note parsing
  - `format-ehr.ts` - EHR-specific formatting
- **Frontend**: `frontend/src/`
  - `components/clipboard/SmartClipboard.tsx`
  - `components/clipboard/SectionSelector.tsx`
  - `hooks/useClipboard.ts`

### 7. Infrastructure Module
- **Root**: `infrastructure/`
  - `serverless.yml` - Main config
  - `resources/` - AWS resources
  - `scripts/deploy.sh` - Deployment
  - `monitoring/` - CloudWatch configs

### 8. Errors Module
- **Backend**: `backend/src/`
  - `utils/error-handler.ts`
  - `utils/logger.ts`
  - `middleware/error-middleware.ts`
- **Frontend**: `frontend/src/`
  - `components/errors/ErrorBoundary.tsx`
  - `components/errors/ErrorNotification.tsx`
  - `utils/error-tracking.ts`

## Implementation Order

1. **First**: Infrastructure (setup base)
2. **Second**: Errors (global handling)
3. **Third**: Auth (security foundation)
4. **Fourth**: Encounters (patient management)
5. **Fifth**: Audio (recording capability)
6. **Sixth**: Transcription (process audio)
7. **Seventh**: Notes (generate documentation)
8. **Eighth**: Clipboard (export functionality)

## HIPAA Compliance Checklist

For EVERY module implementation:
- [ ] Encrypt all PHI at rest and in transit
- [ ] Implement audit logging for all PHI access
- [ ] Add role-based access controls
- [ ] Include BAA compliance for third-party services
- [ ] Implement data retention policies
- [ ] Add security headers to all API responses
- [ ] Include error masking for production
- [ ] Test with PHI-like data only

## Testing Requirements

Each module must include:
1. Unit tests for all functions
2. Integration tests for API endpoints
3. Component tests for React components
4. E2E tests for critical user flows
5. Security tests for authorization
6. Performance tests for scalability