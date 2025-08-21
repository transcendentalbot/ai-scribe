/**
 * CloudWatch metrics helper for monitoring Lambda performance and business metrics
 */
export declare class Metrics {
    private namespace;
    constructor(namespace?: string);
    /**
     * Record a count metric
     */
    count(metricName: string, value?: number, unit?: string, dimensions?: Record<string, string>): void;
    /**
     * Record a duration metric in milliseconds
     */
    duration(metricName: string, startTime: number, dimensions?: Record<string, string>): void;
    /**
     * Record a gauge metric (e.g., current value)
     */
    gauge(metricName: string, value: number, unit?: string, dimensions?: Record<string, string>): void;
    /**
     * Record success/failure metrics
     */
    success(operation: string, dimensions?: Record<string, string>): void;
    failure(operation: string, errorType: string, dimensions?: Record<string, string>): void;
    /**
     * Record API endpoint metrics
     */
    apiCall(endpoint: string, method: string, statusCode: number, duration: number): void;
    /**
     * Record authentication metrics
     */
    authAttempt(success: boolean, method: string, reason?: string): void;
    /**
     * Record PHI access for compliance
     */
    phiAccess(userId: string, resourceType: string, action: string): void;
    /**
     * Record transcription metrics
     */
    transcription(duration: number, wordCount: number, success: boolean): void;
}
export declare const metrics: Metrics;
//# sourceMappingURL=metrics.d.ts.map