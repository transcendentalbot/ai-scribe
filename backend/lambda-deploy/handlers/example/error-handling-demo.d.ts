export declare const handler: import("../../middleware/error-handler").HandlerFunction;
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
//# sourceMappingURL=error-handling-demo.d.ts.map