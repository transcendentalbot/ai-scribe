# implement-module

Implement a complete module for the AI Scribe MVP based on the context files.

## Usage
/implement-module [module-name]

## Available Modules
- auth (Authentication & User Management)
- encounters (Patient & Encounter Management)  
- audio (Audio Recording System)
- transcription (Transcription Service)
- notes (Clinical Note Generation)
- clipboard (Smart Clipboard & EHR Integration)
- infrastructure (AWS Infrastructure)
- errors (Error Handling & Notifications)

## What This Command Does
1. Validates the module name and checks for dependencies
2. Reads the corresponding context file from Project Knowledge
3. Creates the module directory structure
4. Implements all components described in the module:
   - Lambda functions with proper error handling
   - React components with TypeScript
   - DynamoDB schemas with encryption
   - API Gateway configurations
   - Unit and integration tests
5. Ensures HIPAA compliance throughout
6. Adds audit logging for all PHI access
7. Implements security headers and encryption

## Module Dependencies
- **infrastructure**: Required first (base setup)
- **errors**: Required second (global error handling)
- **auth**: Required for all other modules
- **encounters**: Required for audio, transcription, notes
- **audio**: Required for transcription
- **transcription**: Required for notes
- **notes**: Required for clipboard

## Implementation Process
1. **Validation Phase**
   - Check if module name is valid
   - Verify dependencies are implemented
   - Confirm Project Knowledge context file exists

2. **Setup Phase**
   - Create directory structure
   - Initialize configuration files
   - Set up test environment

3. **Implementation Phase**
   - Generate Lambda handlers from templates
   - Create React components
   - Build database schemas
   - Implement API endpoints

4. **Compliance Phase**
   - Add HIPAA audit logging
   - Implement encryption for PHI
   - Add security headers
   - Configure access controls

5. **Testing Phase**
   - Generate unit tests
   - Create integration tests
   - Add HIPAA compliance tests
   - Include performance tests

## Example
```
/implement-module auth
```

This will create:

### Backend Structure
```
backend/src/
├── handlers/auth/
│   ├── login.ts
│   ├── logout.ts
│   ├── refresh.ts
│   └── verify.ts
├── middleware/
│   └── auth.ts
├── utils/
│   ├── jwt.ts
│   └── password.ts
└── models/
    └── user.ts
```

### Frontend Structure
```
frontend/src/
├── components/auth/
│   ├── LoginForm.tsx
│   ├── LogoutButton.tsx
│   └── ProtectedRoute.tsx
├── contexts/
│   └── AuthContext.tsx
├── hooks/
│   └── useAuth.ts
└── services/
    └── auth.service.ts
```

### Infrastructure
```
infrastructure/
├── tables/
│   └── users-table.yml
├── functions/
│   └── auth-functions.yml
└── api/
    └── auth-endpoints.yml
```

### Tests
```
tests/
├── unit/
│   ├── handlers/auth/
│   └── components/auth/
├── integration/
│   └── auth-flow.test.ts
└── compliance/
    └── hipaa-auth.test.ts
```

## Error Handling
If the command fails, it will:
1. Provide clear error messages
2. Suggest which dependencies to implement first
3. Roll back any partial changes
4. Log the error for debugging

## HIPAA Compliance Features
Every module implementation includes:
- PHI encryption at rest and in transit
- Audit logging for all data access
- Role-based access controls (RBAC)
- Session timeout configuration
- Security headers on all responses
- Input validation and sanitization
- Error masking in production