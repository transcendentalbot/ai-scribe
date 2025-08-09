# AI Scribe Authentication API Testing Guide

## Base URL
- Production: `https://gy8gxc5m3c.execute-api.us-east-1.amazonaws.com/prod`

## Important Note
The Cognito User Pool is currently configured to not allow self-registration. Users must be created through the AWS Console or by an administrator. To test the authentication flow:
1. Create a user in the AWS Cognito Console or using AWS CLI:
   ```bash
   aws cognito-idp admin-create-user \
     --user-pool-id us-east-1_qmUZoBLKu \
     --username user@example.com \
     --user-attributes Name=email,Value=user@example.com Name=given_name,Value=John Name=family_name,Value=Doe \
     --temporary-password "TempPass123!" \
     --message-action SUPPRESS
   ```
2. The user will be in FORCE_CHANGE_PASSWORD status
3. To enable self-registration, update the Cognito User Pool settings in the AWS Console

## Authentication Endpoints

### 1. Register User
**Endpoint:** `POST /auth/register`  
**Public:** Yes

**Request Body:**
```json
{
  "email": "doctor@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+1234567890",
  "licenseNumber": "MD12345",
  "specialty": "General Practice",
  "organization": "City Hospital"
}
```

**Response (201):**
```json
{
  "message": "Registration successful. Please check your email for verification code.",
  "userId": "uuid-here"
}
```

### 2. Login
**Endpoint:** `POST /auth/login`  
**Public:** Yes

**Request Body:**
```json
{
  "email": "doctor@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "doctor@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phoneNumber": "+1234567890",
    "licenseNumber": "MD12345",
    "specialty": "General Practice",
    "organization": "City Hospital"
  },
  "tokens": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "idToken": "eyJ..."
  }
}
```

### 3. Refresh Token
**Endpoint:** `POST /auth/refresh`  
**Public:** Yes

**Request Body:**
```json
{
  "refreshToken": "your-refresh-token"
}
```

**Response (200):**
```json
{
  "tokens": {
    "accessToken": "eyJ...",
    "idToken": "eyJ..."
  }
}
```

### 4. Get Current User
**Endpoint:** `GET /auth/me`  
**Public:** No (Requires Authentication)

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "id": "uuid",
  "email": "doctor@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+1234567890",
  "licenseNumber": "MD12345",
  "specialty": "General Practice",
  "organization": "City Hospital",
  "emailVerified": true,
  "mfaEnabled": false,
  "createdAt": "2024-01-01T00:00:00Z",
  "lastLoginAt": "2024-01-02T00:00:00Z"
}
```

### 5. Logout
**Endpoint:** `POST /auth/logout`  
**Public:** No (Requires Authentication)

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

### 6. Forgot Password
**Endpoint:** `POST /auth/forgot-password`  
**Public:** Yes

**Request Body:**
```json
{
  "email": "doctor@example.com"
}
```

**Response (200):**
```json
{
  "message": "If an account exists with this email, you will receive a password reset code."
}
```

### 7. Confirm Forgot Password
**Endpoint:** `POST /auth/confirm-forgot-password`  
**Public:** Yes

**Request Body:**
```json
{
  "email": "doctor@example.com",
  "code": "123456",
  "newPassword": "NewSecurePass123!"
}
```

**Response (200):**
```json
{
  "message": "Password reset successfully. You can now login with your new password."
}
```

## Testing with cURL

### Register a new user:
```bash
curl -X POST https://eqcjvzsjq1.execute-api.us-east-1.amazonaws.com/prod/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

### Login:
```bash
curl -X POST https://eqcjvzsjq1.execute-api.us-east-1.amazonaws.com/prod/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!"
  }'
```

### Get current user (requires access token from login):
```bash
curl -X GET https://eqcjvzsjq1.execute-api.us-east-1.amazonaws.com/prod/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Error Responses

All endpoints return errors in the following format:
```json
{
  "message": "Error message",
  "errors": [] // Optional validation errors
}
```

Common HTTP status codes:
- 400: Bad Request (validation errors)
- 401: Unauthorized (invalid or missing token)
- 403: Forbidden (email not verified)
- 404: Not Found
- 409: Conflict (user already exists)
- 500: Internal Server Error

## Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (@$!%*?&)

## Notes
- All endpoints support CORS
- Access tokens expire after 15 minutes
- Refresh tokens expire after 1 day
- Email verification is required before login
- MFA can be enabled after initial setup