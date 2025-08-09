import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { z } from 'zod';
import { errorHandler } from '../../middleware/error-handler';
import { validateBody, validateQueryParams, getAuthToken } from '../../middleware/request-validator';
import { logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';
import { 
  ValidationError, 
  AuthenticationError, 
  AuthorizationError, 
  NotFoundError,
  ConflictError,
  RateLimitError,
  BusinessLogicError,
  PHIAccessError,
  InternalError
} from '../../errors';
import { response } from '../../utils/response';

// Example schemas
const DemoBodySchema = z.object({
  action: z.enum(['validate', 'auth', 'notfound', 'conflict', 'ratelimit', 'business', 'phi', 'internal']),
  data: z.record(z.any()).optional(),
});

const DemoQuerySchema = z.object({
  debug: z.enum(['true', 'false']).optional(),
});

/**
 * Demonstration handler showing all error handling capabilities
 */
const demoHandler = async (event: APIGatewayProxyEvent, context: Context) => {
  const startTime = Date.now();

  // Validate query parameters
  const queryParams = validateQueryParams(event, DemoQuerySchema);
  const debug = queryParams.debug === 'true';

  // Log with structured data
  logger.info('Error handling demo requested', {
    path: event.path,
    debug,
  });

  // Validate request body
  const body = validateBody(event, DemoBodySchema);

  // Demonstrate different error types based on action
  switch (body.action) {
    case 'validate':
      // This will throw a ZodError, caught by error handler
      z.object({
        required: z.string(),
        email: z.string().email(),
      }).parse(body.data || {});
      break;

    case 'auth':
      // Demonstrate authentication error
      const token = getAuthToken(event);
      if (token !== 'valid-token') {
        throw new AuthenticationError('Invalid authentication token');
      }
      break;

    case 'notfound':
      // Demonstrate not found error
      throw new NotFoundError('User');

    case 'conflict':
      // Demonstrate conflict error
      throw new ConflictError('User with this email already exists');

    case 'ratelimit':
      // Demonstrate rate limit error
      metrics.count('RateLimitExceeded', 1, 'Count', { Endpoint: '/demo' });
      throw new RateLimitError('API rate limit exceeded. Please try again in 60 seconds.');

    case 'business':
      // Demonstrate business logic error
      throw new BusinessLogicError('Cannot process order: insufficient inventory', 422);

    case 'phi':
      // Demonstrate PHI access error
      logger.audit('UNAUTHORIZED_PHI_ACCESS', 'user123', 'patient456', {
        attemptedAction: 'read',
        reason: 'No consent on file',
      });
      throw new PHIAccessError('You do not have permission to access this patient\'s records');

    case 'internal':
      // Demonstrate internal error (non-operational)
      throw new InternalError('Database connection failed', false);

    default:
      // Should never reach here due to schema validation
      throw new ValidationError('Invalid action');
  }

  // If we get here, action was 'auth' with valid token
  metrics.success('ErrorHandlingDemo', { Action: body.action });
  metrics.duration('DemoHandlerDuration', startTime);

  return response.success({
    message: 'Action completed successfully',
    action: body.action,
    debug: debug ? {
      correlationId: context.awsRequestId,
      duration: Date.now() - startTime,
    } : undefined,
  });
};

// Export with error handling
export const handler = errorHandler(demoHandler);

/**
 * Example usage with curl:
 * 
 * # Validation error
 * curl -X POST https://api.example.com/demo \
 *   -H "Content-Type: application/json" \
 *   -d '{"action": "validate", "data": {"email": "invalid-email"}}'
 * 
 * # Authentication error
 * curl -X POST https://api.example.com/demo \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer invalid-token" \
 *   -d '{"action": "auth"}'
 * 
 * # Not found error
 * curl -X POST https://api.example.com/demo \
 *   -H "Content-Type: application/json" \
 *   -d '{"action": "notfound"}'
 * 
 * # Business logic error
 * curl -X POST https://api.example.com/demo \
 *   -H "Content-Type: application/json" \
 *   -d '{"action": "business"}'
 */