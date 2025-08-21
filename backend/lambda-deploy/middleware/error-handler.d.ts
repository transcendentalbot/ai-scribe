import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
export interface HandlerFunction {
    (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult>;
}
/**
 * Error handling middleware for Lambda functions
 * Wraps handlers to provide consistent error handling and logging
 */
export declare const errorHandler: (handler: HandlerFunction) => HandlerFunction;
//# sourceMappingURL=error-handler.d.ts.map