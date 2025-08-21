import { APIGatewayProxyEvent } from 'aws-lambda';
import { ZodSchema } from 'zod';
/**
 * Validates request body against a Zod schema
 */
export declare function validateBody<T>(event: APIGatewayProxyEvent, schema: ZodSchema<T>): T;
/**
 * Validates query string parameters against a Zod schema
 */
export declare function validateQueryParams<T>(event: APIGatewayProxyEvent, schema: ZodSchema<T>): T;
/**
 * Validates path parameters against a Zod schema
 */
export declare function validatePathParams<T>(event: APIGatewayProxyEvent, schema: ZodSchema<T>): T;
/**
 * Extracts and validates authorization token from headers
 */
export declare function getAuthToken(event: APIGatewayProxyEvent): string;
/**
 * Validates content type header
 */
export declare function validateContentType(event: APIGatewayProxyEvent, expectedType: string): void;
//# sourceMappingURL=request-validator.d.ts.map