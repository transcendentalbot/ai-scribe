/**
 * Structured logging utility for Lambda functions
 * Outputs JSON formatted logs for CloudWatch and monitoring
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogContext {
  [key: string]: any;
}

class Logger {
  private serviceName: string;
  private environment: string;

  constructor() {
    this.serviceName = process.env.SERVICE_NAME || 'ai-scribe';
    this.environment = process.env.ENVIRONMENT || 'dev';
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
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

  debug(message: string, context?: LogContext): void {
    if (process.env.LOG_LEVEL === 'DEBUG') {
      this.log(LogLevel.DEBUG, message, context);
    }
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, context);
  }

  /**
   * Log metrics that can be parsed by CloudWatch Insights
   */
  metric(name: string, value: number, unit: string, dimensions?: Record<string, string>): void {
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
  performance(operation: string, duration: number, metadata?: LogContext): void {
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
  audit(action: string, userId: string, resourceId: string, metadata?: LogContext): void {
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

export const logger = new Logger();