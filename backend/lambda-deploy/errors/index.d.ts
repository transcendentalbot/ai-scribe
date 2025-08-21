/**
 * Custom error classes for the application
 */
export declare class BaseError extends Error {
    readonly statusCode: number;
    readonly isOperational: boolean;
    readonly errors?: any[];
    constructor(message: string, statusCode: number, isOperational?: boolean, errors?: any[]);
}
export declare class ValidationError extends BaseError {
    constructor(message?: string, errors?: any[]);
}
export declare class AuthenticationError extends BaseError {
    constructor(message?: string);
}
export declare class AuthorizationError extends BaseError {
    constructor(message?: string);
}
export declare class NotFoundError extends BaseError {
    constructor(resource?: string);
}
export declare class ConflictError extends BaseError {
    constructor(message?: string);
}
export declare class RateLimitError extends BaseError {
    constructor(message?: string);
}
export declare class InternalError extends BaseError {
    constructor(message?: string, isOperational?: boolean);
}
export declare class ServiceUnavailableError extends BaseError {
    constructor(message?: string);
}
export declare class BusinessLogicError extends BaseError {
    constructor(message: string, statusCode?: number);
}
export declare class PHIAccessError extends BaseError {
    constructor(message?: string);
}
export declare class AuditError extends BaseError {
    constructor(message?: string);
}
//# sourceMappingURL=index.d.ts.map