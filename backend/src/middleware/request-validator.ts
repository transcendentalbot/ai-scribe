import { APIGatewayProxyEvent } from 'aws-lambda';
import { ZodSchema } from 'zod';
import { ValidationError } from '../errors';

/**
 * Validates request body against a Zod schema
 */
export function validateBody<T>(event: APIGatewayProxyEvent, schema: ZodSchema<T>): T {
  try {
    const body = JSON.parse(event.body || '{}');
    return schema.parse(body);
  } catch (error: any) {
    if (error.name === 'SyntaxError') {
      throw new ValidationError('Invalid JSON in request body');
    }
    throw error; // Re-throw for error handler to catch Zod errors
  }
}

/**
 * Validates query string parameters against a Zod schema
 */
export function validateQueryParams<T>(event: APIGatewayProxyEvent, schema: ZodSchema<T>): T {
  try {
    return schema.parse(event.queryStringParameters || {});
  } catch (error) {
    throw error; // Re-throw for error handler to catch Zod errors
  }
}

/**
 * Validates path parameters against a Zod schema
 */
export function validatePathParams<T>(event: APIGatewayProxyEvent, schema: ZodSchema<T>): T {
  try {
    return schema.parse(event.pathParameters || {});
  } catch (error) {
    throw error; // Re-throw for error handler to catch Zod errors
  }
}

/**
 * Extracts and validates authorization token from headers
 */
export function getAuthToken(event: APIGatewayProxyEvent): string {
  const authHeader = event.headers.Authorization || event.headers.authorization;
  
  if (!authHeader) {
    throw new ValidationError('No authorization token provided');
  }
  
  if (!authHeader.startsWith('Bearer ')) {
    throw new ValidationError('Invalid authorization header format');
  }
  
  const token = authHeader.substring(7);
  
  if (!token) {
    throw new ValidationError('Empty authorization token');
  }
  
  return token;
}

/**
 * Validates content type header
 */
export function validateContentType(event: APIGatewayProxyEvent, expectedType: string): void {
  const contentType = event.headers['Content-Type'] || event.headers['content-type'];
  
  if (!contentType || !contentType.includes(expectedType)) {
    throw new ValidationError(`Content-Type must be ${expectedType}`);
  }
}