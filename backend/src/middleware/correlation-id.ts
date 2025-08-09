import { APIGatewayProxyEvent } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';

/**
 * Extracts or generates a correlation ID for request tracing
 */
export function getCorrelationId(event: APIGatewayProxyEvent): string {
  // Check various headers for existing correlation ID
  const correlationId = 
    event.headers['X-Correlation-ID'] ||
    event.headers['x-correlation-id'] ||
    event.headers['X-Request-ID'] ||
    event.headers['x-request-id'] ||
    event.headers['X-Amzn-Trace-Id'] ||
    event.headers['x-amzn-trace-id'];

  return correlationId || uuidv4();
}

/**
 * Creates a context object with correlation ID for logging
 */
export function createLogContext(event: APIGatewayProxyEvent, correlationId: string) {
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