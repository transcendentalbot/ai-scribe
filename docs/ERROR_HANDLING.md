# Error Handling Module Documentation

## Overview

The error handling module provides a comprehensive, consistent approach to error handling across all Lambda functions in the AI Scribe application. It includes:

- Custom error classes for different error types
- Middleware for automatic error handling and logging
- Request validation utilities
- Structured logging with CloudWatch integration
- Metrics collection for monitoring
- Correlation ID tracking for distributed tracing

## Architecture

```
┌─────────────────┐
│  Lambda Handler │
└────────┬────────┘
         │
    ┌────▼────┐
    │ Error   │
    │ Handler │ ◄── Wraps all handlers
    │Middleware│
    └────┬────┘
         │
    ┌────▼────────┐
    │   Request   │
    │ Validation  │ ◄── Validates input
    └─────────────┘
         │
    ┌────▼────────┐
    │  Business   │
    │    Logic    │ ◄── Your handler code
    └─────────────┘
         │
    ┌────▼────────┐
    │   Logger &  │
    │   Metrics   │ ◄── Structured logging
    └─────────────┘
```

## Usage

### 1. Wrap Your Handler

```typescript
import { errorHandler } from '../../middleware/error-handler';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';

const myHandler = async (event: APIGatewayProxyEvent, context: Context) => {
  // Your handler logic
};

export const handler = errorHandler(myHandler);
```

### 2. Use Custom Error Classes

```typescript
import { 
  ValidationError, 
  AuthenticationError, 
  NotFoundError,
  ConflictError,
  BusinessLogicError 
} from '../../errors';

// Throw appropriate errors
if (!user) {
  throw new NotFoundError('User');
}

if (emailExists) {
  throw new ConflictError('Email already registered');
}

if (!validToken) {
  throw new AuthenticationError('Invalid token');
}
```

### 3. Validate Requests

```typescript
import { validateBody, validateQueryParams, getAuthToken } from '../../middleware/request-validator';
import { z } from 'zod';

const BodySchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

const handler = async (event: APIGatewayProxyEvent) => {
  // Validate body
  const body = validateBody(event, BodySchema);
  
  // Get auth token
  const token = getAuthToken(event);
  
  // Your logic here
};
```

### 4. Use Structured Logging

```typescript
import { logger } from '../../utils/logger';

// Info logging
logger.info('User created', {
  userId: user.id,
  email: user.email,
});

// Error logging
logger.error('Database error', {
  error: err.message,
  query: 'SELECT * FROM users',
});

// Audit logging (for HIPAA compliance)
logger.audit('PHI_ACCESS', userId, patientId, {
  action: 'VIEW_RECORD',
  ip: event.requestContext.identity.sourceIp,
});
```

### 5. Track Metrics

```typescript
import { metrics } from '../../utils/metrics';

// Count metrics
metrics.count('UserRegistration', 1);

// Duration metrics
const startTime = Date.now();
// ... do work ...
metrics.duration('OperationDuration', startTime);

// Success/Failure metrics
try {
  await doOperation();
  metrics.success('Operation');
} catch (error) {
  metrics.failure('Operation', error.name);
  throw error;
}

// PHI access metrics (for compliance)
metrics.phiAccess(userId, 'PatientRecord', 'Read');
```

## Error Response Format

All errors are returned in a consistent JSON format:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "errors": [] // Optional: Validation errors or additional details
}
```

## HTTP Status Codes

| Error Class | Status Code | Use Case |
|------------|-------------|----------|
| ValidationError | 400 | Invalid request data |
| AuthenticationError | 401 | Missing or invalid credentials |
| AuthorizationError | 403 | Insufficient permissions |
| NotFoundError | 404 | Resource not found |
| ConflictError | 409 | Resource conflict |
| RateLimitError | 429 | Too many requests |
| InternalError | 500 | Server errors |
| ServiceUnavailableError | 503 | Temporary outage |

## Best Practices

1. **Always wrap handlers** with `errorHandler` middleware
2. **Use appropriate error classes** - don't throw generic errors
3. **Include context in logs** - user IDs, resource IDs, etc.
4. **Track metrics** for all important operations
5. **Validate all inputs** using Zod schemas
6. **Log PHI access** for HIPAA compliance
7. **Use correlation IDs** for request tracing

## CloudWatch Integration

The error handling module automatically:
- Logs all requests and responses in JSON format
- Tracks performance metrics
- Records error rates by type
- Creates audit trails for compliance

### CloudWatch Insights Queries

```sql
-- Find all errors in the last hour
fields @timestamp, message, error.name, error.message
| filter level = "ERROR"
| sort @timestamp desc
| limit 100

-- Track API performance
fields @timestamp, operation, duration
| filter message = "Performance metric"
| stats avg(duration), max(duration), min(duration) by operation

-- Audit PHI access
fields @timestamp, userId, resourceId, action
| filter auditType = "PHI_ACCESS"
| sort @timestamp desc
```

## Testing Error Handling

Use the provided demo handler to test different error scenarios:

```bash
# Test validation error
curl -X POST https://api.example.com/demo \
  -H "Content-Type: application/json" \
  -d '{"action": "validate", "data": {"email": "invalid"}}'

# Test authentication error
curl -X POST https://api.example.com/demo \
  -H "Authorization: Bearer wrong-token" \
  -d '{"action": "auth"}'

# Test not found error
curl -X POST https://api.example.com/demo \
  -d '{"action": "notfound"}'
```

## Migration Guide

To migrate existing handlers:

1. Remove try-catch blocks from handler
2. Replace `console.log` with `logger` methods
3. Replace custom errors with error classes
4. Add validation schemas
5. Wrap handler with `errorHandler`
6. Add metrics tracking

### Before:
```typescript
export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    // ... logic ...
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed' }) };
  }
};
```

### After:
```typescript
const myHandler = async (event: APIGatewayProxyEvent) => {
  const body = validateBody(event, Schema);
  logger.info('Processing request', { action: body.action });
  
  // ... logic ...
  
  metrics.success('MyOperation');
  return response.success(result);
};

export const handler = errorHandler(myHandler);
```