"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCorrelationId = getCorrelationId;
exports.createLogContext = createLogContext;
const uuid_1 = require("uuid");
/**
 * Extracts or generates a correlation ID for request tracing
 */
function getCorrelationId(event) {
    // Check various headers for existing correlation ID
    const correlationId = event.headers['X-Correlation-ID'] ||
        event.headers['x-correlation-id'] ||
        event.headers['X-Request-ID'] ||
        event.headers['x-request-id'] ||
        event.headers['X-Amzn-Trace-Id'] ||
        event.headers['x-amzn-trace-id'];
    return correlationId || (0, uuid_1.v4)();
}
/**
 * Creates a context object with correlation ID for logging
 */
function createLogContext(event, correlationId) {
    return {
        correlationId,
        requestId: event.requestContext.requestId,
        sourceIp: event.requestContext.identity.sourceIp,
        userAgent: event.requestContext.identity.userAgent,
        apiId: event.requestContext.apiId,
        stage: event.requestContext.stage,
        path: event.path,
        method: event.httpMethod,
    };
}
//# sourceMappingURL=correlation-id.js.map