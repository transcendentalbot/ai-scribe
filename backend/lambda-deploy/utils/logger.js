"use strict";
/**
 * Structured logging utility for Lambda functions
 * Outputs JSON formatted logs for CloudWatch and monitoring
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.LogLevel = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "DEBUG";
    LogLevel["INFO"] = "INFO";
    LogLevel["WARN"] = "WARN";
    LogLevel["ERROR"] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class Logger {
    serviceName;
    environment;
    constructor() {
        this.serviceName = process.env.SERVICE_NAME || 'ai-scribe';
        this.environment = process.env.ENVIRONMENT || 'dev';
    }
    log(level, message, context) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            service: this.serviceName,
            environment: this.environment,
            message,
            ...context,
        };
        // In Lambda, console.log outputs to CloudWatch
        console.log(JSON.stringify(logEntry));
    }
    debug(message, context) {
        if (process.env.LOG_LEVEL === 'DEBUG') {
            this.log(LogLevel.DEBUG, message, context);
        }
    }
    info(message, context) {
        this.log(LogLevel.INFO, message, context);
    }
    warn(message, context) {
        this.log(LogLevel.WARN, message, context);
    }
    error(message, context) {
        this.log(LogLevel.ERROR, message, context);
    }
    /**
     * Log metrics that can be parsed by CloudWatch Insights
     */
    metric(name, value, unit, dimensions) {
        const metric = {
            _aws: {
                Timestamp: Date.now(),
                CloudWatchMetrics: [{
                        Namespace: `${this.serviceName}/${this.environment}`,
                        Dimensions: dimensions ? [Object.keys(dimensions)] : [],
                        Metrics: [{
                                Name: name,
                                Unit: unit,
                            }],
                    }],
            },
            [name]: value,
            ...dimensions,
        };
        console.log(JSON.stringify(metric));
    }
    /**
     * Log performance metrics
     */
    performance(operation, duration, metadata) {
        this.info('Performance metric', {
            operation,
            duration,
            ...metadata,
        });
        // Also emit as CloudWatch metric
        this.metric('OperationDuration', duration, 'Milliseconds', {
            Operation: operation,
        });
    }
    /**
     * Log audit events for HIPAA compliance
     */
    audit(action, userId, resourceId, metadata) {
        this.info('Audit event', {
            auditType: 'PHI_ACCESS',
            action,
            userId,
            resourceId,
            timestamp: new Date().toISOString(),
            ...metadata,
        });
    }
}
exports.logger = new Logger();
//# sourceMappingURL=logger.js.map