# deploy

Deploy both backend (AWS CDK) and frontend (Vercel) with a single command.

## Usage
```
/deploy
```

## What This Command Does

1. **Backend Deployment (AWS CDK)**
   - Navigates to `infrastructure-cdk` directory
   - Runs `./deploy.sh` to deploy the CDK stack to AWS
   - Deploys: Lambda functions, API Gateway, WebSocket API, DynamoDB, S3, Cognito, etc.

2. **Frontend Deployment (Vercel)**
   - Navigates to `frontend` directory
   - Builds the Next.js application
   - Deploys to Vercel production environment
   - Uses the configuration in `vercel.json` to ensure correct build from frontend folder

## Prerequisites

- AWS CLI configured with credentials
- CDK CLI installed (`npm install -g aws-cdk`)
- Vercel CLI installed (`npm install -g vercel`)
- Frontend `.env.local` file configured with backend URLs

## Process

1. First deploys backend to AWS using CDK
2. Shows the API Gateway URLs from CDK output
3. Reminds to update frontend environment variables if needed
4. Builds and deploys frontend to Vercel from the frontend directory

## Example
```
/deploy
```

This will:
- Deploy backend infrastructure to AWS
- Deploy frontend application to Vercel
- Show deployment status and any errors for manual fixing