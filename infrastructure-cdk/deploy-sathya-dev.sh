#!/bin/bash

# AI Scribe CDK Deployment Script - Sathya Dev Environment

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
STAGE="sathya-dev"
ALERT_EMAIL=${ALERT_EMAIL:-"sathya@healthspaceai.com"}

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}AI Scribe CDK Deployment - Sathya Dev${NC}"
echo -e "${GREEN}========================================${NC}"
echo "Stage: $STAGE"
echo "Alert Email: $ALERT_EMAIL"
echo ""

# AWS CLI path (use Windows version)
AWS_CLI="/mnt/c/Program Files/Amazon/AWSCLIV2/aws.exe"

# Check if AWS CLI is configured
if ! "$AWS_CLI" sts get-caller-identity >/dev/null 2>&1; then
    echo -e "${RED}Error: AWS CLI is not configured or you're not authenticated${NC}"
    echo "Please run 'aws configure' or set AWS credentials"
    exit 1
fi

# Show current AWS account
ACCOUNT_ID=$("$AWS_CLI" sts get-caller-identity --query Account --output text)
REGION=$("$AWS_CLI" configure get region || echo "us-east-1")
echo -e "${YELLOW}Deploying to:${NC}"
echo "  Account: $ACCOUNT_ID"
echo "  Region: $REGION"
echo "  Stack Name: ai-scribe-$STAGE"
echo ""

# Check if CDK is installed
if ! command -v cdk &> /dev/null; then
    echo -e "${RED}Error: AWS CDK is not installed${NC}"
    echo "Install with: npm install -g aws-cdk"
    exit 1
fi

# Install dependencies
echo -e "${GREEN}Installing dependencies...${NC}"
npm install

# Build TypeScript
echo -e "${GREEN}Building TypeScript...${NC}"
npm run build

# Bootstrap CDK if needed
echo -e "${GREEN}Checking CDK bootstrap...${NC}"
if ! "$AWS_CLI" cloudformation describe-stacks --stack-name CDKToolkit >/dev/null 2>&1; then
    echo -e "${YELLOW}Bootstrapping CDK...${NC}"
    npx cdk bootstrap
fi

# Deploy the stack
echo -e "${GREEN}Deploying stack ai-scribe-$STAGE...${NC}"
npx cdk deploy ai-scribe-$STAGE \
  --context stage=$STAGE \
  --context alertEmail=$ALERT_EMAIL \
  --require-approval never

# Get stack outputs
echo -e "${GREEN}Retrieving stack outputs...${NC}"
OUTPUTS=$("$AWS_CLI" cloudformation describe-stacks \
    --stack-name ai-scribe-$STAGE \
    --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
    --output json)

# Parse important outputs
API_URL=$(echo $OUTPUTS | jq -r '.[] | select(.[0]=="ApiUrl") | .[1]')
WS_URL=$(echo $OUTPUTS | jq -r '.[] | select(.[0]=="WebSocketUrl") | .[1]')
USER_POOL_ID=$(echo $OUTPUTS | jq -r '.[] | select(.[0]=="UserPoolId") | .[1]')
USER_POOL_CLIENT_ID=$(echo $OUTPUTS | jq -r '.[] | select(.[0]=="UserPoolClientId") | .[1]')

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

echo -e "${BLUE}Stack Outputs:${NC}"
echo "  API Gateway URL: $API_URL"
echo "  WebSocket URL: $WS_URL"
echo "  User Pool ID: $USER_POOL_ID"
echo "  User Pool Client ID: $USER_POOL_CLIENT_ID"
echo ""

echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Configure OpenAI API Key:"
echo "   \"$AWS_CLI\" secretsmanager put-secret-value \\"
echo "     --secret-id ai-scribe-$STAGE-openai \\"
echo "     --secret-string \"sk-your-openai-api-key\""
echo ""
echo "2. Configure Deepgram API Key:"
echo "   \"$AWS_CLI\" secretsmanager put-secret-value \\"
echo "     --secret-id ai-scribe-$STAGE-deepgram \\"
echo "     --secret-string \"your-deepgram-api-key\""
echo ""
echo "3. Set Vercel Environment Variables:"
echo "   vercel env add NEXT_PUBLIC_API_URL"
echo "   # Enter: $API_URL"
echo "   vercel env add NEXT_PUBLIC_WS_URL"
echo "   # Enter: $WS_URL"
echo ""
echo "4. Deploy Frontend:"
echo "   vercel --name ai-scribe-sathya-dev"
echo ""

# Save outputs to file for easy reference
cat > sathya-dev-outputs.json << EOF
{
  "stage": "$STAGE",
  "apiUrl": "$API_URL",
  "wsUrl": "$WS_URL",
  "userPoolId": "$USER_POOL_ID",
  "userPoolClientId": "$USER_POOL_CLIENT_ID",
  "region": "$REGION",
  "accountId": "$ACCOUNT_ID"
}
EOF

echo -e "${GREEN}Outputs saved to: sathya-dev-outputs.json${NC}"
echo ""
echo -e "${YELLOW}To destroy this environment later:${NC}"
echo "  npx cdk destroy ai-scribe-$STAGE --context stage=$STAGE"