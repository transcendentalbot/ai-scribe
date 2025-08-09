# Authentication Module Context

## Requirements
- Admin-created provider accounts only (no self-registration)
- Email/password login with MFA optional
- 30-minute session timeout with warning at 25 minutes
- Single practice per provider for MVP
- Role: provider only (admin features in v2)

## Database Schema (DynamoDB)
- Table: ai-scribe-mvp
- PK: USER#{userId}
- SK: METADATA
- Attributes: email, passwordHash, role, practiceId, firstName, lastName, npiNumber, createdAt, lastLogin

## API Endpoints
POST /auth/login - Email/password authentication
POST /auth/logout - Invalidate session
POST /auth/refresh - Refresh access token
GET /auth/session - Check session validity

## Security Requirements
- Bcrypt for password hashing
- JWT tokens with practiceId claim
- Rate limit: 5 login attempts per minute
- Account lockout after 10 failed attempts
- Audit log all authentication events

## UI Requirements
- Clean login form with email/password
- "Remember me" checkbox (refresh token)
- Session timeout warning modal at 25 minutes
- Auto-logout at 30 minutes
- Clear error messages for failed login

**Cursor Prompt**:
```
Create an authentication system for the medical scribe app:
1. Lambda functions for login/logout/refresh endpoints
2. DynamoDB schema with single-table design
3. Cognito user pool setup with admin-only user creation
4. React login component with form validation
5. Auth context/hook for session management
6. Automatic session timeout with warning modal

Include proper error handling, audit logging, and HIPAA compliance.
```