# AI Scribe Infrastructure

This directory contains the AWS infrastructure code for the AI Scribe MVP, a HIPAA-compliant medical transcription service.

## Architecture Overview

The infrastructure is built using AWS SAM (Serverless Application Model) and includes:

- **API Gateway**: REST and WebSocket APIs for client communication
- **Lambda Functions**: Serverless compute for all business logic
- **DynamoDB**: Single-table design for all application data
- **S3**: Secure storage for audio recordings with lifecycle policies
- **Cognito**: User authentication with MFA support
- **CloudWatch**: Comprehensive monitoring and alerting
- **WAF**: Web Application Firewall for API protection
- **KMS**: Encryption keys for PHI data protection

## Prerequisites

1. AWS CLI installed and configured
2. SAM CLI installed (v1.100+)
3. Node.js 20.x installed
4. AWS account with appropriate permissions

## Project Structure

```
infrastructure/
├── template.yaml              # Main SAM template
├── samconfig.toml            # SAM configuration
├── resources/                # Nested CloudFormation templates
│   ├── api/                 # API Gateway configuration
│   ├── cognito/             # User authentication
│   ├── dynamodb/            # Database tables
│   ├── monitoring/          # CloudWatch setup
│   ├── s3/                  # Storage buckets
│   └── security/            # WAF and security
├── scripts/                  # Deployment scripts
│   ├── deploy.sh            # Main deployment script
│   ├── destroy.sh           # Teardown script
│   └── update-secrets.sh    # Secrets management
├── environments/             # Environment configurations
│   └── example.env          # Environment template
└── layers/                   # Lambda layers
    └── common/              # Shared dependencies
```

## Quick Start

1. Clone the repository and navigate to the infrastructure directory:
   ```bash
   cd infrastructure
   ```

2. Deploy the infrastructure:
   ```bash
   ./scripts/deploy.sh dev us-east-1 your-aws-profile
   ```

3. Update API keys:
   ```bash
   ./scripts/update-secrets.sh dev your-aws-profile
   ```

## Deployment

### Development Environment

```bash
# Deploy to dev environment
./scripts/deploy.sh dev

# Or use SAM directly
sam deploy --config-env default
```

### Staging Environment

```bash
# Deploy to staging
./scripts/deploy.sh staging

# Or use SAM directly
sam deploy --config-env staging
```

### Production Environment

```bash
# Deploy to production (requires confirmation)
./scripts/deploy.sh prod

# Or use SAM directly
sam deploy --config-env prod
```

## Configuration

### Environment Variables

Copy `environments/example.env` to `environments/{stage}.env` and update values:

```bash
cp environments/example.env environments/dev.env
# Edit environments/dev.env with your values
```

### Secrets Management

Sensitive values are stored in AWS Secrets Manager:

- JWT signing secret
- Deepgram API key
- OpenAI API key

Update secrets using the provided script:
```bash
./scripts/update-secrets.sh dev
```

## Security Features

### HIPAA Compliance

- All PHI data encrypted at rest (KMS) and in transit (TLS)
- Audit logging for all data access
- Automatic session timeout
- MFA support for user authentication
- Data retention policies (7 years for audit logs)

### WAF Protection

- Rate limiting (2000 requests/5 min per IP)
- SQL injection protection
- Known bad inputs filtering
- Geographic restrictions (configurable)
- Custom API key validation

### Security Headers

All API responses include:
- Strict-Transport-Security
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection
- Content-Security-Policy
- Referrer-Policy

## Monitoring

### CloudWatch Dashboard

Access the monitoring dashboard:
```
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=ai-scribe-dev
```

### Alarms

Configured alarms for:
- API Gateway 4XX/5XX errors
- Lambda function errors and throttles
- DynamoDB errors
- S3 bucket size (cost control)
- Failed transcriptions
- Budget alerts

### Logs

All logs are encrypted and retained for 30 days:
- `/aws/apigateway/ai-scribe-{stage}`
- `/aws/lambda/ai-scribe-{stage}`
- `/aws/wafv2/{stage}/ai-scribe`

## Cost Optimization

- DynamoDB on-demand pricing
- S3 lifecycle policies (IA after 30 days, Glacier after 90 days)
- Lambda reserved concurrency limits
- CloudWatch log retention policies
- Budget alerts at 80% and 100%

## Troubleshooting

### Common Issues

1. **Deployment fails with "Access Denied"**
   - Ensure your AWS profile has necessary permissions
   - Check if deployment bucket exists and is accessible

2. **Lambda functions timing out**
   - Check CloudWatch logs for errors
   - Increase timeout in template.yaml if needed

3. **API returns 403 Forbidden**
   - Verify API key is included in request
   - Check WAF logs for blocked requests

### Debug Mode

Enable debug logging:
```bash
export SAM_CLI_TELEMETRY=0
sam deploy --debug
```

## Maintenance

### Updating Dependencies

1. Update layer dependencies:
   ```bash
   cd layers/common/nodejs
   npm update
   npm audit fix
   ```

2. Redeploy the stack:
   ```bash
   sam deploy
   ```

### Backup and Recovery

- DynamoDB: Point-in-time recovery enabled
- S3: Versioning enabled on all buckets
- CloudFormation: Stack update history maintained

## Destruction

To completely remove the infrastructure:

```bash
./scripts/destroy.sh dev
```

**Warning**: This will delete all resources including data. Create backups first!

## Support

For issues or questions:
1. Check CloudWatch logs
2. Review alarm history
3. Contact the development team

## License

Copyright © 2024 HealthSpaceAI. All rights reserved.