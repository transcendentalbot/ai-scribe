"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
            receivedBody: event.body,
            isBase64Encoded: event.isBase64Encoded,
            headers: event.headers,
        }),
    };
};
exports.handler = handler;
//# sourceMappingURL=test-echo.js.map