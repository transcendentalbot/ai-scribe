# AI Scribe MVP Development Instructions

## Primary Directive
You are developing a HIPAA-compliant medical scribe application. Always follow the rules in ./Project Knowledge/cursorrules.md and reference the specific context files for each module.

## Project Context
- **Application**: Medical scribe for primary care providers
- **Compliance**: HIPAA, HITECH Act, WCAG 2.1
- **Backend**: AWS Lambda (Node.js 20.x) with DynamoDB
- **Frontend**: Next.js 14 with TypeScript, deployed to Vercel
- **Key Features**: Audio recording, real-time transcription, SOAP note generation, smart clipboard

## Code Generation Requirements
1. Follow the technical standards in ./Project Knowledge/PRP.md
2. Apply security rules from ./Project Knowledge/cursorrules.md
3. Reference the relevant context file for module-specific requirements
4. Generate complete, production-ready code (no placeholders)
5. Include comprehensive error handling
6. Add detailed comments for complex logic
7. Ensure all PHI is encrypted at rest and in transit
8. Implement audit logging for all data access

## Module References
When implementing specific features, always consult:
- **Authentication**: ./Project Knowledge/auth-context.md
- **Encounters**: ./Project Knowledge/encounter-context.md
- **Audio Recording**: ./Project Knowledge/audio-context.md
- **Transcription**: ./Project Knowledge/transcription-context.md
- **Note Generation**: ./Project Knowledge/note-generation-context.md
- **Smart Clipboard**: ./Project Knowledge/clipboard-context.md
- **Infrastructure**: ./Project Knowledge/infrastructure-context.md
- **Error Handling**: ./Project Knowledge/error-handling-context.md

## Security First
- NEVER log PHI (patient names, MRN, conversations, diagnoses)
- Always encrypt sensitive data using AWS KMS
- Implement row-level security in DynamoDB
- Session timeout after 30 minutes
- Delete audio files after 24 hours

## Development Workflow
1. Always read the relevant context file before implementing a module
2. Follow the cursor prompts provided in each context file
3. Test HIPAA compliance for every feature
4. Ensure mobile responsiveness and accessibility
5. Implement comprehensive error handling with user-friendly messages

## Quality Standards
- TypeScript strict mode required
- Minimum 80% test coverage
- Response times must be <2 seconds
- All async operations need loading states
- Follow conventional commits (feat:, fix:, chore:, docs:)

Remember: Patient safety and data security are paramount. When in doubt, choose the more secure option.