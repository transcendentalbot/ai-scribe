# Infrastructure Context

## AWS Resources
- API Gateway: REST and WebSocket APIs
- Lambda: Node.js 20.x, 3MB limit
- DynamoDB: Single table, on-demand pricing
- S3: Audio storage with lifecycle
- Cognito: User authentication
- CloudWatch: Logs and monitoring
- EventBridge: Async processing
- SES: Email notifications

## Security
- VPC not required (serverless)
- API Gateway API keys
- CloudFront for frontend
- WAF rules for common attacks
- Encryption at rest (KMS)

## Deployment
- Frontend: Vercel deployment
- Backend: SAM or CDK
- Environment: dev, staging, prod
- Secrets: AWS Secrets Manager

## Monitoring
- CloudWatch alarms for errors
- X-Ray for tracing
- Budget alerts
- Failed transcription alerts

**Cursor Prompt**:
```
Set up AWS infrastructure:
1. SAM template for all Lambda functions
2. API Gateway with auth and CORS
3. DynamoDB table with GSIs
4. S3 bucket with lifecycle rules
5. Cognito user pool configuration
6. CloudWatch alarms and dashboards

Include deployment scripts and environment configuration.
```