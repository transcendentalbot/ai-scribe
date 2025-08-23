#!/bin/bash

# AI Scribe CDK Deployment Script - Simplified Version

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Default values
STAGE=${1:-production}
SHOW_OUTPUTS=${2:-false}

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}AI Scribe CDK Deployment - Simplified${NC}"
echo -e "${GREEN}========================================${NC}"
echo "Stage: $STAGE"
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo -e "${RED}Error: AWS CLI is not configured or you're not authenticated${NC}"
    echo "Please run 'aws configure' or set AWS credentials"
    exit 1
fi

# Show current AWS account
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region || echo "us-east-1")
echo -e "${YELLOW}Deploying to:${NC}"
echo "  Account: $ACCOUNT_ID"
echo "  Region: $REGION"
echo ""

# Check if CDK is installed
if ! command -v npx cdk &> /dev/null; then
    echo -e "${RED}Error: AWS CDK is not installed${NC}"
    echo "Install with: npm install -g aws-cdk"
    exit 1
fi

# Build TypeScript
echo -e "${GREEN}Building TypeScript...${NC}"
npm run build

# Deploy the stack
echo -e "${GREEN}Deploying stack ai-scribe-$STAGE...${NC}"
npx cdk deploy ai-scribe-$STAGE \
  --context stage=$STAGE \
  --require-approval never

# Show outputs if requested
if [ "$SHOW_OUTPUTS" = "true" ] || [ "$SHOW_OUTPUTS" = "yes" ]; then
    echo -e "${GREEN}Stack Outputs:${NC}"
    aws cloudformation describe-stacks \
        --stack-name ai-scribe-$STAGE \
        --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
        --output table
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"

# Show helpful next steps
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Update frontend environment variables with the stack outputs"
echo "2. Deploy frontend: cd frontend && vercel --prod"
echo "3. Update Deepgram API key in Secrets Manager (if not already done)"
echo ""
echo "To view stack outputs anytime, run:"
echo "  aws cloudformation describe-stacks --stack-name ai-scribe-$STAGE --query 'Stacks[0].Outputs'"