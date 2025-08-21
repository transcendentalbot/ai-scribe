/**
 * Structured logging utility for Lambda functions
 * Outputs JSON formatted logs for CloudWatch and monitoring
 */
export declare enum LogLevel {
    DEBUG = "DEBUG",
    INFO = "INFO",
    WARN = "WARN",
    ERROR = "ERROR"
}
interface LogContext {
    [key: string]: any;
}
declare class Logger {
    private serviceName;
    private environment;
    constructor();
    private log;
    debug(message: string, context?: LogContext): void;
    info(message: string, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    error(message: string, context?: LogContext): void;
    /**
     * Log metrics that can be parsed by CloudWatch Insights
     */
    metric(name: string, value: number, unit: string, dimensions?: Record<string, string>): void;
    /**
     * Log performance metrics
     */
    performance(operation: string, duration: number, metadata?: LogContext): void;
    /**
     * Log audit events for HIPAA compliance
     */
    audit(action: string, userId: string, resourceId: string, metadata?: LogContext): void;
}
export declare const logger: Logger;
export {};
//# sourceMappingURL=logger.d.ts.map