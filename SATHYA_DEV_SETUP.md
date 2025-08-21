# Sathya-Dev Environment Setup Guide

## 🎯 Overview
This guide sets up a personal development environment called `sathya-dev` for testing the SOAP notes feature safely.

## 🚀 Quick Deploy

### Deploy Backend Infrastructure
```bash
cd infrastructure-cdk
./deploy-sathya-dev.sh
```

This creates:
- **Stack Name**: `ai-scribe-sathya-dev`
- **Resources**: Isolated AWS resources with `sathya-dev` prefix
- **Cost**: Minimal (pay-per-use DynamoDB, Lambda, etc.)

## 📋 What Gets Created

### AWS Resources
- **DynamoDB Tables**: `ai-scribe-main-sathya-dev`, `ai-scribe-ws-connections-sathya-dev`
- **S3 Buckets**: `ai-scribe-audio-sathya-dev-{account}-v2`
- **Lambda Functions**: `ai-scribe-sathya-dev-*` (15+ functions)
- **API Gateway**: `ai-scribe-sathya-dev` REST + WebSocket APIs
- **Secrets**: `ai-scribe-sathya-dev-openai`, `ai-scribe-sathya-dev-deepgram`
- **EventBridge**: `ai-scribe-sathya-dev-event-bus`

### Key Features Enabled
✅ **Complete SOAP Notes System**
✅ **GPT-4 Integration** 
✅ **Real-time Transcription**
✅ **Medical Codes Management**
✅ **Digital Signatures**
✅ **Event-driven Architecture**

## 🔧 Configuration Steps

### 1. Deploy Backend
```bash
cd infrastructure-cdk
./deploy-sathya-dev.sh
```

### 2. Configure API Keys
```bash
# OpenAI API Key (required for SOAP notes)
aws secretsmanager put-secret-value \
  --secret-id ai-scribe-sathya-dev-openai \
  --secret-string "sk-your-openai-api-key"

# Deepgram API Key (for transcription)
aws secretsmanager put-secret-value \
  --secret-id ai-scribe-sathya-dev-deepgram \
  --secret-string "your-deepgram-api-key"
```

### 3. Deploy Frontend to Vercel
```bash
# Create dedicated Vercel project
vercel --name ai-scribe-sathya-dev

# Set environment variables (use outputs from step 1)
vercel env add NEXT_PUBLIC_API_URL
vercel env add NEXT_PUBLIC_WS_URL
vercel env add NEXT_PUBLIC_ENVIRONMENT
# Enter: sathya-dev
```

## 🧪 Testing SOAP Notes

### Access Your Environment
- **Frontend**: `https://ai-scribe-sathya-dev.vercel.app`
- **Backend API**: `https://{api-id}.execute-api.us-east-1.amazonaws.com/sathya-dev`

### Test Flow
1. **Login** to the application
2. **Create Patient** and **Encounter**
3. **Start Recording** → Test real-time transcription
4. **Generate SOAP Note** → Test GPT-4 integration
5. **Edit Note** → Test auto-save functionality
6. **Add Medical Codes** → Test ICD-10/CPT lookup
7. **Sign Note** → Test digital signature workflow

## 📊 Monitoring

### CloudWatch Logs
```bash
# Note generation logs
aws logs tail /aws/lambda/ai-scribe-sathya-dev-generate-note --follow

# API Gateway logs  
aws logs tail /aws/apigateway/ai-scribe-sathya-dev --follow
```

### DynamoDB Data
```bash
# Check created notes
aws dynamodb scan \
  --table-name ai-scribe-main-sathya-dev \
  --filter-expression "begins_with(pk, :pk)" \
  --expression-attribute-values '{":pk":{"S":"NOTE#"}}'
```

## 💰 Cost Management

### Estimated Monthly Cost (Light Usage)
- **DynamoDB**: $5-10 (pay-per-request)
- **Lambda**: $2-5 (first 1M requests free)
- **API Gateway**: $3-5 (first 1M requests $3.50)
- **S3**: $1-3 (audio storage)
- **Total**: ~$15-25/month

### Cost Optimization
- Auto-delete old audio files (7-year retention configured)
- DynamoDB pay-per-request (no idle costs)
- Lambda scales to zero when not used

## 🗑️ Cleanup

### Destroy Environment
```bash
cd infrastructure-cdk
cdk destroy ai-scribe-sathya-dev --context stage=sathya-dev
```

### Delete Vercel Project
```bash
vercel remove ai-scribe-sathya-dev
```

## 🔐 Security Features

### Data Protection
- **Encryption**: All data encrypted at rest (KMS)
- **HIPAA Compliance**: PHI handling compliant
- **Access Control**: Provider-scoped authorization
- **Audit Logging**: Complete audit trail

### Network Security
- **WAF**: Rate limiting and security rules
- **CORS**: Configured for your domain only
- **HTTPS**: TLS 1.2+ enforced

## 🎉 Success Indicators

✅ **Backend Deployed**: Stack creation successful
✅ **Secrets Configured**: OpenAI + Deepgram keys set
✅ **Frontend Deployed**: Vercel deployment successful
✅ **End-to-End Test**: Complete SOAP notes workflow
✅ **No Production Impact**: Isolated environment

Your `sathya-dev` environment is ready for SOAP notes testing! 🚀

## 📞 Support

If you encounter issues:
1. Check CloudWatch logs for errors
2. Verify API keys in Secrets Manager
3. Confirm environment variables in Vercel
4. Test individual components (auth → recording → transcription → notes)