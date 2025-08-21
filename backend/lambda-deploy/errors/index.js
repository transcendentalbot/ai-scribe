"use strict";
/**
 * Custom error classes for the application
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditError = exports.PHIAccessError = exports.BusinessLogicError = exports.ServiceUnavailableError = exports.InternalError = exports.RateLimitError = exports.ConflictError = exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.ValidationError = exports.BaseError = void 0;
class BaseError extends Error {
    statusCode;
    isOperational;
    errors;
    constructor(message, statusCode, isOperational = true, errors) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.errors = errors;
        // Maintains proper stack trace
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.BaseError = BaseError;
// 400 Bad Request
class ValidationError extends BaseError {
    constructor(message = 'Validation failed', errors) {
        super(message, 400, true, errors);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
// 401 Unauthorized
class AuthenticationError extends BaseError {
    constructor(message = 'Authentication failed') {
        super(message, 401, true);
        this.name = 'AuthenticationError';
    }
}
exports.AuthenticationError = AuthenticationError;
// 403 Forbidden
class AuthorizationError extends BaseError {
    constructor(message = 'Access forbidden') {
        super(message, 403, true);
        this.name = 'AuthorizationError';
    }
}
exports.AuthorizationError = AuthorizationError;
// 404 Not Found
class NotFoundError extends BaseError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404, true);
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
// 409 Conflict
class ConflictError extends BaseError {
    constructor(message = 'Resource conflict') {
        super(message, 409, true);
        this.name = 'ConflictError';
    }
}
exports.ConflictError = ConflictError;
// 429 Too Many Requests
class RateLimitError extends BaseError {
    constructor(message = 'Too many requests') {
        super(message, 429, true);
        this.name = 'RateLimitError';
    }
}
exports.RateLimitError = RateLimitError;
// 500 Internal Server Error
class InternalError extends BaseError {
    constructor(message = 'Internal server error', isOperational = false) {
        super(message, 500, isOperational);
        this.name = 'InternalError';
    }
}
exports.InternalError = InternalError;
// 503 Service Unavailable
class ServiceUnavailableError extends BaseError {
    constructor(message = 'Service temporarily unavailable') {
        super(message, 503, true);
        this.name = 'ServiceUnavailableError';
    }
}
exports.ServiceUnavailableError = ServiceUnavailableError;
// Business logic errors
class BusinessLogicError extends BaseError {
    constructor(message, statusCode = 400) {
        super(message, statusCode, true);
        this.name = 'BusinessLogicError';
    }
}
exports.BusinessLogicError = BusinessLogicError;
// HIPAA Compliance specific errors
class PHIAccessError extends BaseError {
    constructor(message = 'Unauthorized access to PHI') {
        super(message, 403, true);
        this.name = 'PHIAccessError';
    }
}
exports.PHIAccessError = PHIAccessError;
class AuditError extends BaseError {
    constructor(message = 'Audit trail error') {
        super(message, 500, false);
        this.name = 'AuditError';
    }
}
exports.AuditError = AuditError;
//# sourceMappingURL=index.js.map