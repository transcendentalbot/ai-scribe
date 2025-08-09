import { APIGatewayProxyResult } from 'aws-lambda';

export const response = {
  success(data: any, statusCode = 200): APIGatewayProxyResult {
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
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
        'Access-Control-Allow-Credentials': 'true',
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