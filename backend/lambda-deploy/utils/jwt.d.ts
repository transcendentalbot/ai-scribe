import { APIGatewayProxyEvent } from 'aws-lambda';
interface JWTPayload {
    sub: string;
    email?: string;
    given_name?: string;
    family_name?: string;
    'cognito:username'?: string;
    'custom:provider_id'?: string;
    'custom:user_id'?: string;
    exp?: number;
    iat?: number;
}
/**
 * Decodes a JWT token without verification (for use after API Gateway has already verified it)
 */
export declare function decodeJWT(token: string): JWTPayload;
/**
 * Extracts user information from the request's JWT token
 */
export declare function getUserFromToken(event: APIGatewayProxyEvent): {
    userId: string;
    email?: string;
    firstName?: string;
    lastName?: string;
};
/**
 * Gets the provider ID from the token (for backwards compatibility)
 */
export declare function getProviderIdFromToken(event: APIGatewayProxyEvent): string;
export {};
//# sourceMappingURL=jwt.d.ts.map