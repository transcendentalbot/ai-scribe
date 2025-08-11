import { APIGatewayProxyEvent } from 'aws-lambda';
import { getAuthToken } from '../middleware/request-validator';
import { AuthorizationError } from '../errors';

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
export function decodeJWT(token: string): JWTPayload {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }
    
    // Decode the payload (second part)
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload;
  } catch (error) {
    throw new AuthorizationError('Invalid JWT token');
  }
}

/**
 * Extracts user information from the request's JWT token
 */
export function getUserFromToken(event: APIGatewayProxyEvent): {
  userId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
} {
  const token = getAuthToken(event);
  const payload = decodeJWT(token);
  
  // Try different fields for user ID (handle both custom:provider_id and custom:user_id)
  const userId = payload['custom:provider_id'] || 
                 payload['custom:user_id'] || 
                 payload.sub;
  
  if (!userId) {
    throw new AuthorizationError('User ID not found in token');
  }
  
  return {
    userId,
    email: payload.email,
    firstName: payload.given_name,
    lastName: payload.family_name,
  };
}

/**
 * Gets the provider ID from the token (for backwards compatibility)
 */
export function getProviderIdFromToken(event: APIGatewayProxyEvent): string {
  const { userId } = getUserFromToken(event);
  return userId;
}