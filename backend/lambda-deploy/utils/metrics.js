"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metrics = exports.Metrics = void 0;
const logger_1 = require("./logger");
/**
 * CloudWatch metrics helper for monitoring Lambda performance and business metrics
 */
class Metrics {
    namespace;
    constructor(namespace) {
        this.namespace = namespace || `AIScribe/${process.env.ENVIRONMENT || 'dev'}`;
    }
    /**
     * Record a count metric
     */
    count(metricName, value = 1, unit = 'Count', dimensions) {
        logger_1.logger.metric(metricName, value, unit, dimensions);
    }
    /**
     * Record a duration metric in milliseconds
     */
    duration(metricName, startTime, dimensions) {
        const duration = Date.now() - startTime;
        logger_1.logger.metric(metricName, duration, 'Milliseconds', dimensions);
    }
    /**
     * Record a gauge metric (e.g., current value)
     */
    gauge(metricName, value, unit = 'None', dimensions) {
        logger_1.logger.metric(metricName, value, unit, dimensions);
    }
    /**
     * Record success/failure metrics
     */
    success(operation, dimensions) {
        this.count(`${operation}.Success`, 1, 'Count', dimensions);
    }
    failure(operation, errorType, dimensions) {
        this.count(`${operation}.Failure`, 1, 'Count', { ...dimensions, ErrorType: errorType });
    }
    /**
     * Record API endpoint metrics
     */
    apiCall(endpoint, method, statusCode, duration) {
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
    authAttempt(success, method, reason) {
        const metricName = success ? 'AuthSuccess' : 'AuthFailure';
        const dimensions = { Method: method };
        if (reason) {
            dimensions.Reason = reason;
        }
        this.count(metricName, 1, 'Count', dimensions);
    }
    /**
     * Record PHI access for compliance
     */
    phiAccess(userId, resourceType, action) {
        this.count('PHIAccess', 1, 'Count', {
            UserId: userId,
            ResourceType: resourceType,
            Action: action,
        });
    }
    /**
     * Record transcription metrics
     */
    transcription(duration, wordCount, success) {
        if (success) {
            this.duration('TranscriptionDuration', Date.now() - duration);
            this.gauge('TranscriptionWordCount', wordCount, 'Count');
            this.count('TranscriptionSuccess');
        }
        else {
            this.count('TranscriptionFailure');
        }
    }
}
exports.Metrics = Metrics;
exports.metrics = new Metrics();
//# sourceMappingURL=metrics.js.map