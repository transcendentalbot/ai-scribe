#!/bin/bash

# AI Scribe CDK Deployment Script

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Default values
STAGE=${1:-production}
REGION=${2:-us-east-1}

echo -e "${GREEN}Starting AI Scribe CDK deployment...${NC}"
echo "Stage: $STAGE"
echo "Region: $REGION"

# Build TypeScript
echo -e "${GREEN}Building TypeScript...${NC}"
npm run build

# Bootstrap CDK (only needed once per account/region)
echo -e "${GREEN}Bootstrapping CDK environment...${NC}"
cdk bootstrap aws://unknown-account/$REGION || true

# Synthesize CloudFormation template
echo -e "${GREEN}Synthesizing CloudFormation template...${NC}"
cdk synth

# Deploy the stack
echo -e "${GREEN}Deploying stack...${NC}"
npm run build && cdk deploy ai-scribe-$STAGE \
  --context stage=$STAGE \
  --require-approval never

# Create secrets
echo -e "${GREEN}Creating secrets...${NC}"
STACK_NAME="ai-scribe-$STAGE"

# JWT Secret
if ! aws secretsmanager describe-secret --secret-id "${STACK_NAME}-jwt-secret" 2>/dev/null; then
    echo -e "${GREEN}Creating JWT secret...${NC}"
    aws secretsmanager create-secret \
        --name "${STACK_NAME}-jwt-secret" \
        --description "JWT signing secret for AI Scribe" \
        --secret-string "{\"secret\":\"$(openssl rand -base64 32)\"}"
else
    echo -e "${YELLOW}JWT secret already exists.${NC}"
fi

# Deepgram API Key
if ! aws secretsmanager describe-secret --secret-id "${STACK_NAME}-deepgram" 2>/dev/null; then
    echo -e "${GREEN}Creating Deepgram API key secret...${NC}"
    echo -e "${YELLOW}Please update this secret with your actual Deepgram API key${NC}"
    aws secretsmanager create-secret \
        --name "${STACK_NAME}-deepgram" \
        --description "Deepgram API key for transcription" \
        --secret-string "{\"api-key\":\"YOUR_DEEPGRAM_API_KEY\"}"
else
    echo -e "${YELLOW}Deepgram secret already exists.${NC}"
fi

# Get outputs
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"

# Show stack outputs
aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
    --output table

echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Update Deepgram API key in Secrets Manager"
echo "2. Deploy the auth module: /implement-module auth"
echo "3. Deploy frontend to Vercel"