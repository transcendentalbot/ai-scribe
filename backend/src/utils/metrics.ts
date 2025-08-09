import { logger } from './logger';

/**
 * CloudWatch metrics helper for monitoring Lambda performance and business metrics
 */
export class Metrics {
  private namespace: string;

  constructor(namespace?: string) {
    this.namespace = namespace || `AIScribe/${process.env.ENVIRONMENT || 'dev'}`;
  }

  /**
   * Record a count metric
   */
  count(metricName: string, value = 1, unit = 'Count', dimensions?: Record<string, string>): void {
    logger.metric(metricName, value, unit, dimensions);
  }

  /**
   * Record a duration metric in milliseconds
   */
  duration(metricName: string, startTime: number, dimensions?: Record<string, string>): void {
    const duration = Date.now() - startTime;
    logger.metric(metricName, duration, 'Milliseconds', dimensions);
  }

  /**
   * Record a gauge metric (e.g., current value)
   */
  gauge(metricName: string, value: number, unit = 'None', dimensions?: Record<string, string>): void {
    logger.metric(metricName, value, unit, dimensions);
  }

  /**
   * Record success/failure metrics
   */
  success(operation: string, dimensions?: Record<string, string>): void {
    this.count(`${operation}.Success`, 1, 'Count', dimensions);
  }

  failure(operation: string, errorType: string, dimensions?: Record<string, string>): void {
    this.count(`${operation}.Failure`, 1, 'Count', { ...dimensions, ErrorType: errorType });
  }

  /**
   * Record API endpoint metrics
   */
  apiCall(endpoint: string, method: string, statusCode: number, duration: number): void {
    const dimensions = {
      Endpoint: endpoint,
      Method: method,
      StatusCode: statusCode.toString(),
    };

    this.count('APICall', 1, 'Count', dimensions);
    this.duration('APICallDuration', Date.now() - duration, dimensions);

    if (statusCode >= 400) {
      this.count('APIError', 1, 'Count', dimensions);
    }
  }

  /**
   * Record authentication metrics
   */
  authAttempt(success: boolean, method: string, reason?: string): void {
    const metricName = success ? 'AuthSuccess' : 'AuthFailure';
    const dimensions: Record<string, string> = { Method: method };
    
    if (reason) {
      dimensions.Reason = reason;
    }

    this.count(metricName, 1, 'Count', dimensions);
  }

  /**
   * Record PHI access for compliance
   */
  phiAccess(userId: string, resourceType: string, action: string): void {
    this.count('PHIAccess', 1, 'Count', {
      UserId: userId,
      ResourceType: resourceType,
      Action: action,
    });
  }

  /**
   * Record transcription metrics
   */
  transcription(duration: number, wordCount: number, success: boolean): void {
    if (success) {
      this.duration('TranscriptionDuration', Date.now() - duration);
      this.gauge('TranscriptionWordCount', wordCount, 'Count');
      this.count('TranscriptionSuccess');
    } else {
      this.count('TranscriptionFailure');
    }
  }
}

export const metrics = new Metrics();