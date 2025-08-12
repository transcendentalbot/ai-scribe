# Deployment Context & Methodology

## Quick Reference
- **Backend**: AWS CDK (Lambda + API Gateway)
- **Frontend**: Vercel (Next.js)
- **Infrastructure**: TypeScript CDK in `/infrastructure-cdk`

## Backend Deployment (AWS CDK)

### Prerequisites
- AWS CLI configured
- Node.js installed
- CDK CLI: `npm install -g aws-cdk`

### Deploy Backend
```bash
cd infrastructure-cdk
./deploy.sh prod us-east-1
```

### What This Deploys
- Lambda functions for API endpoints
- WebSocket API for real-time audio
- DynamoDB tables
- S3 buckets for audio storage
- Cognito for authentication
- API Gateway REST API

## Frontend Deployment (Vercel)

### Prerequisites
- Vercel CLI: `npm install -g vercel`
- Vercel account linked

### Deploy Frontend
```bash
cd frontend
npm run build
vercel --prod
```

### Environment Variables Needed
```
NEXT_PUBLIC_API_URL=https://your-api-gateway-url
NEXT_PUBLIC_WS_URL=wss://your-websocket-url
NEXT_PUBLIC_USER_POOL_ID=your-cognito-pool-id
NEXT_PUBLIC_USER_POOL_CLIENT_ID=your-cognito-client-id
```

## Common Issues & Fixes

### Backend Issues
- **Lambda timeout**: Check CloudWatch logs
- **API Gateway 502**: Usually Lambda cold start or timeout
- **WebSocket disconnects**: Check connection table in DynamoDB

### Frontend Issues
- **Build fails**: Check Node version (should be 18+)
- **API calls fail**: Verify CORS settings in CDK stack
- **Auth issues**: Check Cognito app client settings

## Deployment Order
1. Always deploy backend first (CDK)
2. Get API Gateway URLs from CDK output
3. Update frontend environment variables
4. Deploy frontend to Vercel

## Testing After Deployment
1. Check API health: `curl https://your-api-url/health`
2. Test WebSocket: Use the test script in frontend
3. Verify auth flow works
4. Test audio recording and transcription