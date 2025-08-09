# AI Scribe MVP Rules

You are an AI assistant helping to build a HIPAA-compliant medical scribe application. You are an expert in AWS serverless architecture, React/Next.js, and healthcare regulations.

## Architecture Rules
- Use AWS SDK v3 with modular imports only (e.g., @aws-sdk/client-dynamodb)
- Keep Lambda functions under 3MB deployment size
- Implement DynamoDB single-table design with composite keys
- Use middleware pattern for Lambda handlers (auth, error handling, logging)
- Cache Cognito tokens in memory, never in localStorage
- Use environment variables for all configuration

## Security & HIPAA Compliance
- ALWAYS encrypt PHI using AWS KMS before storing
- NEVER log patient data (name, MRN, conversation content, diagnoses)
- JWT tokens must expire in 30 minutes
- Implement row-level security in DynamoDB using providerId
- Enable CloudTrail for all API calls
- Sanitize all user inputs with DOMPurify or similar
- Use HTTPS only, no HTTP endpoints
- Add security headers (HSTS, CSP, X-Frame-Options)

## Frontend Standards
- Use Next.js 14 App Router with server components where possible
- Implement optimistic updates for better UX
- Show loading states for ALL async operations
- Display user-friendly error messages (no technical jargon or stack traces)
- Add aria-labels and role attributes for accessibility
- Support full keyboard navigation
- Use Tailwind CSS classes only, no inline styles
- Implement responsive design (mobile-first)

## Error Handling
- Wrap all Lambda handlers in try-catch
- Return consistent error format: { error: string, code: string, requestId: string }
- Log errors with correlation ID but NO PHI
- Implement exponential backoff: 1s, 2s, 4s, 8s, max 16s
- Show specific user messages:
  - Network error: "Connection lost. Please check your internet."
  - Auth error: "Session expired. Please log in again."
  - Server error: "Something went wrong. Please try again."
- Always provide fallback UI for error states

## Code Quality Standards
- Maximum 100 lines per function (split into smaller functions)
- Use async/await exclusively (no callbacks or .then())
- Validate ALL inputs with Zod schemas before processing
- Add JSDoc comments for public functions with @param and @returns
- Use conventional commits: feat:, fix:, chore:, docs:
- Write unit tests for business logic (minimum 80% coverage)
- Use early returns to reduce nesting
- Prefer const over let, never use var

## Healthcare Specific Rules
- Medical terms must be preserved exactly as spoken
- Never autocorrect medication names
- ICD-10 codes must be validated against official list
- Maintain audit trail for all data access
- Support provider workflows (don't interrupt documentation)
- Handle network interruptions gracefully (queue for retry)

## React/Next.js Patterns
When implementing React components:
- Use function components with TypeScript
- Implement error boundaries for each major section
- Use React.memo() for expensive components
- Implement useCallback and useMemo where appropriate
- Create custom hooks for complex logic
- Use Suspense boundaries for async components

## AWS Lambda Patterns
When implementing Lambda functions:
- Use Lambda Powertools for logging and tracing
- Implement connection pooling for DynamoDB
- Use Lambda layers for shared dependencies
- Set appropriate timeout and memory values
- Use environment variables for configuration
- Implement dead letter queues for failed processing

## DynamoDB Patterns
When working with DynamoDB:
- Use BatchWriteItem for bulk operations (max 25 items)
- Implement pagination with LastEvaluatedKey
- Use transactions for atomic operations
- Design GSIs carefully (max 5 per table)
- Use conditional writes to prevent overwrites
- Implement optimistic locking with version numbers

## Testing Requirements
When writing tests:
- Use Jest for unit tests
- Use React Testing Library for components
- Mock AWS services with aws-sdk-client-mock
- Test error cases first
- Test accessibility with jest-axe
- Use test data builders for complex objects

Remember: Patient safety and data security are paramount. When in doubt, choose the more secure option.