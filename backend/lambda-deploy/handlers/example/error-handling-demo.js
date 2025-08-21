"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const zod_1 = require("zod");
const error_handler_1 = require("../../middleware/error-handler");
const request_validator_1 = require("../../middleware/request-validator");
const logger_1 = require("../../utils/logger");
const metrics_1 = require("../../utils/metrics");
const errors_1 = require("../../errors");
const response_1 = require("../../utils/response");
// Example schemas
const DemoBodySchema = zod_1.z.object({
    action: zod_1.z.enum(['validate', 'auth', 'notfound', 'conflict', 'ratelimit', 'business', 'phi', 'internal']),
    data: zod_1.z.record(zod_1.z.any()).optional(),
});
const DemoQuerySchema = zod_1.z.object({
    debug: zod_1.z.enum(['true', 'false']).optional(),
});
/**
 * Demonstration handler showing all error handling capabilities
 */
const demoHandler = async (event, context) => {
    const startTime = Date.now();
    // Validate query parameters
    const queryParams = (0, request_validator_1.validateQueryParams)(event, DemoQuerySchema);
    const debug = queryParams.debug === 'true';
    // Log with structured data
    logger_1.logger.info('Error handling demo requested', {
        path: event.path,
        debug,
    });
    // Validate request body
    const body = (0, request_validator_1.validateBody)(event, DemoBodySchema);
    // Demonstrate different error types based on action
    switch (body.action) {
        case 'validate':
            // This will throw a ZodError, caught by error handler
            zod_1.z.object({
                required: zod_1.z.string(),
                email: zod_1.z.string().email(),
            }).parse(body.data || {});
            break;
        case 'auth':
            // Demonstrate authentication error
            const token = (0, request_validator_1.getAuthToken)(event);
            if (token !== 'valid-token') {
                throw new errors_1.AuthenticationError('Invalid authentication token');
            }
            break;
        case 'notfound':
            // Demonstrate not found error
            throw new errors_1.NotFoundError('User');
        case 'conflict':
            // Demonstrate conflict error
            throw new errors_1.ConflictError('User with this email already exists');
        case 'ratelimit':
            // Demonstrate rate limit error
            metrics_1.metrics.count('RateLimitExceeded', 1, 'Count', { Endpoint: '/demo' });
            throw new errors_1.RateLimitError('API rate limit exceeded. Please try again in 60 seconds.');
        case 'business':
            // Demonstrate business logic error
            throw new errors_1.BusinessLogicError('Cannot process order: insufficient inventory', 422);
        case 'phi':
            // Demonstrate PHI access error
            logger_1.logger.audit('UNAUTHORIZED_PHI_ACCESS', 'user123', 'patient456', {
                attemptedAction: 'read',
                reason: 'No consent on file',
            });
            throw new errors_1.PHIAccessError('You do not have permission to access this patient\'s records');
        case 'internal':
            // Demonstrate internal error (non-operational)
            throw new errors_1.InternalError('Database connection failed', false);
        default:
            // Should never reach here due to schema validation
            throw new errors_1.ValidationError('Invalid action');
    }
    // If we get here, action was 'auth' with valid token
    metrics_1.metrics.success('ErrorHandlingDemo', { Action: body.action });
    metrics_1.metrics.duration('DemoHandlerDuration', startTime);
    return response_1.response.success({
        message: 'Action completed successfully',
        action: body.action,
        debug: debug ? {
            correlationId: context.awsRequestId,
            duration: Date.now() - startTime,
        } : undefined,
    });
};
// Export with error handling
exports.handler = (0, error_handler_1.errorHandler)(demoHandler);
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
//# sourceMappingURL=error-handling-demo.js.map