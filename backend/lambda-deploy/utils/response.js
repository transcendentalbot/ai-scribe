"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = exports.response = void 0;
exports.response = {
    success(data, statusCode = 200) {
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
    error(message, statusCode = 400, errors) {
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
class AppError extends Error {
    message;
    statusCode;
    errors;
    constructor(message, statusCode = 400, errors) {
        super(message);
        this.message = message;
        this.statusCode = statusCode;
        this.errors = errors;
        this.name = 'AppError';
    }
}
exports.AppError = AppError;
//# sourceMappingURL=response.js.map