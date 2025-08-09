# Claude Project Setup Guide for AI Scribe MVP

## 1. Create a Claude Project

**Project Name:** AI Scribe MVP Development

## 2. Add Project Knowledge

Add these documents to your Claude Project Knowledge section:

### Required Files:
- `PRP.md` - Complete PRP document (from earlier artifact)
- `cursorrules.md` - Global coding rules (extract from PRP)
- `auth-context.md` - Authentication module context
- `encounter-context.md` - Patient encounter module context
- `audio-context.md` - Audio recording module context
- `transcription-context.md` - Transcription service context
- `note-generation-context.md` - Clinical note generation context
- `clipboard-context.md` - Smart clipboard context
- `infrastructure-context.md` - AWS infrastructure context
- `error-handling-context.md` - Error handling patterns context

## 3. Project Instructions

Copy and paste this into your Claude Project Instructions:

```markdown
You are developing a HIPAA-compliant medical scribe application. Always follow the rules in cursorrules.md and reference the specific context files for each module.

When generating code:
1. Follow the technical standards in PRP.md
2. Apply security rules from cursorrules.md
3. Reference the relevant context file for module-specific requirements
4. Generate complete, production-ready code (no placeholders)
5. Include comprehensive error handling
6. Add detailed comments for complex logic

Project Structure:
- Backend: AWS Lambda (Node.js) with DynamoDB
- Frontend: Next.js 14 deployed to Vercel
- Must be HIPAA compliant with full encryption
```

## 4. How to Use with Claude

### Starting a Module:
```
"Using auth-context.md, create the complete authentication system including Lambda functions, DynamoDB schema, and React components"
```

### Building Features:
```
"Implement the audio recording system based on audio-context.md with all error handling and user notifications"
```

### Integration Tasks:
```
"Connect the transcription service from transcription-context.md with the audio recording module, ensuring proper error handling"
```

## 5. Development Workflow

1. **Start New Chat** in the Project
2. **Reference Specific Context**: "Using [context-file].md..."
3. **Request Complete Implementation**: Ask for full code, not snippets
4. **Iterate in Same Chat**: Keep context by staying in one conversation
5. **Export Code**: Copy generated code to your IDE

## 6. Project Structure

Organize generated code as:

```
ai-scribe-mvp/
├── backend/
│   ├── functions/
│   │   ├── auth/
│   │   │   ├── login.ts
│   │   │   ├── logout.ts
│   │   │   └── refresh.ts
│   │   ├── encounters/
│   │   │   ├── create.ts
│   │   │   ├── list.ts
│   │   │   └── update.ts
│   │   ├── transcription/
│   │   │   ├── websocket.ts
│   │   │   └── process.ts
│   │   └── notes/
│   │       ├── generate.ts
│   │       └── export.ts
│   ├── shared/
│   │   ├── types.ts
│   │   ├── middleware.ts
│   │   └── utils.ts
│   └── template.yaml
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── login/
│   │   └── dashboard/
│   ├── components/
│   │   ├── audio-recorder.tsx
│   │   ├── encounter-list.tsx
│   │   ├── note-editor.tsx
│   │   └── smart-clipboard.tsx
│   ├── hooks/
│   │   ├── use-auth.ts
│   │   ├── use-audio.ts
│   │   └── use-websocket.ts
│   ├── lib/
│   │   ├── api.ts
│   │   └── utils.ts
│   └── package.json
├── infrastructure/
│   └── template.yaml
└── README.md
```

## 7. Best Practices

1. **Keep Context Files Updated**: Update project knowledge as requirements change
2. **Use Specific References**: Always mention which context file you're working from
3. **Request Full Implementations**: Claude can generate complete modules
4. **Maintain Chat Context**: Stay in the same chat for related work
5. **Verify HIPAA Compliance**: Ask Claude to verify security implementations

## 8. Example Claude Prompts

### Initial Setup:
```
"Create the complete project structure with all configuration files, using the tech stack defined in PRP.md"
```

### Module Development:
```
"Using encounter-context.md, build the complete patient encounter management system with all CRUD operations, UI components, and error handling"
```

### Integration:
```
"Integrate the audio recording module with the transcription service, ensuring proper WebSocket handling and error recovery as defined in the context files"
```

### Testing:
```
"Generate comprehensive tests for the authentication module, including unit tests for Lambda functions and integration tests for the API"
```

### Deployment:
```
"Create the AWS SAM template for deploying all Lambda functions with proper permissions and environment variables"
```

## 9. Development Order

Build modules in this sequence for best results:

1. **Infrastructure Setup** - AWS SAM, DynamoDB, Cognito
2. **Authentication** - Login, session management
3. **Encounter Management** - Patient lookup, encounter CRUD
4. **Audio Recording** - Consent, recording, quality monitoring
5. **Transcription** - WebSocket, Deepgram integration
6. **Note Generation** - GPT-4 integration, SOAP formatting
7. **Smart Clipboard** - Parsing, EHR formatting
8. **Error Handling** - Global error handling, notifications

## 10. Verification Checklist

After each module, verify:

- [ ] HIPAA compliance (encryption, audit logs)
- [ ] Error handling (user-friendly messages)
- [ ] Unit tests (>80% coverage)
- [ ] Accessibility (WCAG 2.1 compliance)
- [ ] Performance (response times <2s)
- [ ] Security (input validation, authentication)

## 11. Common Commands

### Backend Development:
```bash
# Install dependencies
cd backend && npm install

# Run tests
npm test

# Deploy to AWS
sam deploy --guided
```

### Frontend Development:
```bash
# Install dependencies
cd frontend && npm install

# Run development server
npm run dev

# Build for production
npm run build

# Deploy to Vercel
vercel deploy
```

## 12. Troubleshooting

### If Claude generates incomplete code:
```
"Please complete the implementation of [specific function/component] with all error handling and edge cases"
```

### If you need more context:
```
"Explain how this module integrates with the rest of the system based on the PRP"
```

### If you need specific patterns:
```
"Show me the DynamoDB single-table design pattern for this module"
```

---

## Quick Start Commands

1. **First prompt to Claude:**
   ```
   "Review all context files and create the initial project structure with configuration files"
   ```

2. **Build authentication:**
   ```
   "Using auth-context.md and cursorrules.md, implement the complete authentication system"
   ```

3. **Add audio recording:**
   ```
   "Using audio-context.md, create the audio recording module with consent management and quality monitoring"
   ```

Continue this pattern for each module, always referencing the specific context file.