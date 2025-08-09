# check-hipaa

Verify HIPAA compliance for the current code or a specific module.

## Usage
/check-hipaa [file-or-module]

## What This Command Checks
1. **Data Encryption**
   - PHI encrypted at rest (AWS KMS)
   - HTTPS only endpoints
   - Encrypted data transmission

2. **Access Controls**
   - Authentication required
   - Row-level security
   - Session management (30-min timeout)

3. **Audit Logging**
   - All data access logged
   - No PHI in logs
   - Correlation IDs present

4. **Data Retention**
   - 7-year retention for notes
   - 24-hour deletion for audio
   - Proper lifecycle policies

5. **Error Handling**
   - No PHI in error messages
   - User-friendly messages
   - Proper error recovery

6. **Security Headers**
   - HSTS enabled
   - CSP configured
   - X-Frame-Options set

## Output
- ✅ Compliant items
- ❌ Non-compliant items with fixes
- ⚠️ Warnings for best practices
- 📋 Compliance checklist

## Example
```
/check-hipaa backend/functions/auth/login.ts
```