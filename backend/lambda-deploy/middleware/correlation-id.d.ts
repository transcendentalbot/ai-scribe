import { APIGatewayProxyEvent } from 'aws-lambda';
/**
 * Extracts or generates a correlation ID for request tracing
 */
export declare function getCorrelationId(event: APIGatewayProxyEvent): string;
/**
 * Creates a context object with correlation ID for logging
 */
export declare function createLogContext(event: APIGatewayProxyEvent, correlationId: string): {
    correlationId: string;
    requestId: string;
    sourceIp: string;
    userAgent: string | null;
    apiId: string;
    stage: string;
    path: string;
    method: string;
};
//# sourceMappingURL=correlation-id.d.ts.map