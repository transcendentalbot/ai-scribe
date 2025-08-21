# Vercel Deployment Guide - SOAP Notes Branch

## 🎯 Overview
This guide shows how to deploy the soap-notes branch to Vercel for testing the SOAP notes feature.

## 🚀 Deployment Options

### Option 1: Deploy soap-notes Branch as Preview
```bash
# From the soap-notes branch
vercel --env=preview

# This creates a preview URL like:
# https://ai-scribe-git-soap-notes-yourteam.vercel.app
```

### Option 2: Create Dedicated Project for Testing
```bash
# Create a new Vercel project specifically for soap-notes
vercel --name ai-scribe-soap-notes

# This creates:
# https://ai-scribe-soap-notes.vercel.app
```

### Option 3: Deploy with Custom Alias
```bash
# Deploy with a custom subdomain
vercel --alias soap-notes-test.vercel.app
```

## 📋 Environment Variables Setup

### Required Environment Variables
Set these in your Vercel project dashboard or via CLI:

```bash
# Backend API endpoints (after deploying DEV backend)
vercel env add NEXT_PUBLIC_API_URL
# Enter: https://your-dev-api-gateway-url

vercel env add NEXT_PUBLIC_WS_URL  
# Enter: wss://your-dev-websocket-url

vercel env add NEXT_PUBLIC_ENVIRONMENT
# Enter: development
```

### Check Current Environment Variables
```bash
vercel env ls
```

## 🔧 Step-by-Step Deployment

### Step 1: Deploy DEV Backend First
```bash
cd infrastructure-cdk
STAGE=dev cdk deploy --all

# Note the outputs:
# - API Gateway URL: https://abc123.execute-api.region.amazonaws.com/dev
# - WebSocket URL: wss://xyz789.execute-api.region.amazonaws.com/dev
```

### Step 2: Configure OpenAI Secret for DEV
```bash
aws secretsmanager put-secret-value \
  --secret-id ai-scribe-stack-dev-openai \
  --secret-string "sk-your-openai-api-key"
```

### Step 3: Deploy Frontend to Vercel
```bash
# Option A: Preview deployment
vercel --env=preview

# Option B: Named project
vercel --name ai-scribe-soap-notes

# Option C: With alias
vercel --alias soap-notes-test.vercel.app
```

### Step 4: Set Environment Variables
```bash
# Set the API URLs from Step 1
vercel env add NEXT_PUBLIC_API_URL
vercel env add NEXT_PUBLIC_WS_URL
vercel env add NEXT_PUBLIC_ENVIRONMENT

# Redeploy to pick up environment variables
vercel --force
```

## 🧪 Testing the Deployment

### Test URLs Structure
- **Preview**: `https://ai-scribe-git-soap-notes-yourteam.vercel.app`
- **Named Project**: `https://ai-scribe-soap-notes.vercel.app`
- **Custom Alias**: `https://soap-notes-test.vercel.app`

### Test Features
1. **Login** with existing credentials
2. **Create/Select** an encounter
3. **Start Recording** → Check transcription
4. **Generate SOAP Note** → Verify GPT-4 integration
5. **Edit Note** → Test auto-save functionality
6. **Add Medical Codes** → Test ICD-10/CPT management
7. **Sign Note** → Test digital signature workflow

## 📊 Monitoring

### Vercel Analytics
- Check deployment logs in Vercel dashboard
- Monitor function execution times
- Track errors and performance

### AWS CloudWatch
- Monitor Lambda function performance
- Check EventBridge events
- Track DynamoDB operations

## 🔄 Branch-Specific Configuration

### Automatic Deployments
The `vercel.json` is configured to auto-deploy both:
- `main` branch → Production
- `soap-notes` branch → Preview/Development

### Manual Control
To disable auto-deployments:
```bash
vercel git disconnect
```

To re-enable:
```bash
vercel git connect
```

## 🚨 Important Notes

1. **Environment Separation**: DEV backend + Preview frontend ensures no production impact
2. **Cost Management**: DEV AWS resources have lower usage/cost
3. **Testing Safety**: All SOAP notes testing happens in isolated environment
4. **Branch Protection**: soap-notes branch deploys to preview, not production

## 🎉 Success Checklist

- [ ] DEV backend deployed with CDK
- [ ] OpenAI API key configured for DEV
- [ ] Vercel preview deployment successful
- [ ] Environment variables set correctly
- [ ] End-to-end SOAP notes workflow tested
- [ ] No impact on production environment

The soap-notes branch is now ready for safe testing on Vercel! 🚀