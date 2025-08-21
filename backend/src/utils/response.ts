import { APIGatewayProxyResult } from 'aws-lambda';

export const response = {
  success(data: any, statusCode = 200): APIGatewayProxyResult {
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token, Accept, Origin',
      },
      body: JSON.stringify({
        success: true,
        data,
      }),
    };
  },

  error(message: string, statusCode = 400, errors?: any): APIGatewayProxyResult {
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token, Accept, Origin',
      },
      body: JSON.stringify({
        success: false,
        message,
        errors,
      }),
    };
  },
};

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400,
    public errors?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}