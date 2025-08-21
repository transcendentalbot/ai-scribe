import { APIGatewayProxyResult } from 'aws-lambda';
export declare const response: {
    success(data: any, statusCode?: number): APIGatewayProxyResult;
    error(message: string, statusCode?: number, errors?: any): APIGatewayProxyResult;
};
export declare class AppError extends Error {
    message: string;
    statusCode: number;
    errors?: any | undefined;
    constructor(message: string, statusCode?: number, errors?: any | undefined);
}
//# sourceMappingURL=response.d.ts.map