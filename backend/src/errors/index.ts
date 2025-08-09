/**
 * Custom error classes for the application
 */

export class BaseError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errors?: any[];

  constructor(
    message: string,
    statusCode: number,
    isOperational = true,
    errors?: any[]
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;

    // Maintains proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

// 400 Bad Request
export class ValidationError extends BaseError {
  constructor(message = 'Validation failed', errors?: any[]) {
    super(message, 400, true, errors);
    this.name = 'ValidationError';
  }
}

// 401 Unauthorized
export class AuthenticationError extends BaseError {
  constructor(message = 'Authentication failed') {
    super(message, 401, true);
    this.name = 'AuthenticationError';
  }
}

// 403 Forbidden
export class AuthorizationError extends BaseError {
  constructor(message = 'Access forbidden') {
    super(message, 403, true);
    this.name = 'AuthorizationError';
  }
}

// 404 Not Found
export class NotFoundError extends BaseError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, true);
    this.name = 'NotFoundError';
  }
}

// 409 Conflict
export class ConflictError extends BaseError {
  constructor(message = 'Resource conflict') {
    super(message, 409, true);
    this.name = 'ConflictError';
  }
}

// 429 Too Many Requests
export class RateLimitError extends BaseError {
  constructor(message = 'Too many requests') {
    super(message, 429, true);
    this.name = 'RateLimitError';
  }
}

// 500 Internal Server Error
export class InternalError extends BaseError {
  constructor(message = 'Internal server error', isOperational = false) {
    super(message, 500, isOperational);
    this.name = 'InternalError';
  }
}

// 503 Service Unavailable
export class ServiceUnavailableError extends BaseError {
  constructor(message = 'Service temporarily unavailable') {
    super(message, 503, true);
    this.name = 'ServiceUnavailableError';
  }
}

// Business logic errors
export class BusinessLogicError extends BaseError {
  constructor(message: string, statusCode = 400) {
    super(message, statusCode, true);
    this.name = 'BusinessLogicError';
  }
}

// HIPAA Compliance specific errors
export class PHIAccessError extends BaseError {
  constructor(message = 'Unauthorized access to PHI') {
    super(message, 403, true);
    this.name = 'PHIAccessError';
  }
}

export class AuditError extends BaseError {
  constructor(message = 'Audit trail error') {
    super(message, 500, false);
    this.name = 'AuditError';
  }
}