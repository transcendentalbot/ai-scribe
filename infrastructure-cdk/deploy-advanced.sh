#!/bin/bash

# AI Scribe CDK Deployment Script - Advanced Version with Options

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS] [STAGE]"
    echo ""
    echo "Deploy AI Scribe infrastructure using AWS CDK"
    echo ""
    echo "Arguments:"
    echo "  STAGE               Deployment stage (default: production)"
    echo ""
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -o, --outputs       Show stack outputs after deployment"
    echo "  -s, --synth         Only synthesize, don't deploy"
    echo "  -d, --diff          Show stack differences before deploying"
    echo "  -b, --bootstrap     Run CDK bootstrap before deployment"
    echo "  -c, --clean         Clean build artifacts before building"
    echo "  -f, --force         Force deployment without confirmation"
    echo "  --hotswap           Use CDK hotswap for faster Lambda updates"
    echo "  --profile PROFILE   Use specific AWS profile"
    echo ""
    echo "Examples:"
    echo "  $0                          # Deploy to production"
    echo "  $0 dev                      # Deploy to dev"
    echo "  $0 -o production            # Deploy and show outputs"
    echo "  $0 -d -o staging            # Show diff, deploy, show outputs"
    echo "  $0 --profile prod-account   # Use specific AWS profile"
    exit 0
}

# Parse arguments
STAGE=""
SHOW_OUTPUTS=false
SYNTH_ONLY=false
SHOW_DIFF=false
RUN_BOOTSTRAP=false
CLEAN_BUILD=false
FORCE_DEPLOY=false
USE_HOTSWAP=false
AWS_PROFILE_ARG=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            ;;
        -o|--outputs)
            SHOW_OUTPUTS=true
            shift
            ;;
        -s|--synth)
            SYNTH_ONLY=true
            shift
            ;;
        -d|--diff)
            SHOW_DIFF=true
            shift
            ;;
        -b|--bootstrap)
            RUN_BOOTSTRAP=true
            shift
            ;;
        -c|--clean)
            CLEAN_BUILD=true
            shift
            ;;
        -f|--force)
            FORCE_DEPLOY=true
            shift
            ;;
        --hotswap)
            USE_HOTSWAP=true
            shift
            ;;
        --profile)
            AWS_PROFILE_ARG="--profile $2"
            export AWS_PROFILE=$2
            shift 2
            ;;
        *)
            STAGE=$1
            shift
            ;;
    esac
done

# Set default stage if not provided
STAGE=${STAGE:-production}

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}AI Scribe CDK Deployment${NC}"
echo -e "${GREEN}========================================${NC}"
echo "Stage: $STAGE"
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity $AWS_PROFILE_ARG >/dev/null 2>&1; then
    echo -e "${RED}Error: AWS CLI is not configured or you're not authenticated${NC}"
    echo "Please run 'aws configure' or set AWS credentials"
    exit 1
fi

# Show current AWS account
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text $AWS_PROFILE_ARG)
REGION=$(aws configure get region $AWS_PROFILE_ARG || echo "us-east-1")
echo -e "${YELLOW}Deploying to:${NC}"
echo "  Account: $ACCOUNT_ID"
echo "  Region: $REGION"
echo "  Stage: $STAGE"
echo ""

# Check if CDK is installed
if ! command -v cdk &> /dev/null; then
    echo -e "${RED}Error: AWS CDK is not installed${NC}"
    echo "Install with: npm install -g aws-cdk"
    exit 1
fi

# Check if stack exists
STACK_EXISTS=false
if aws cloudformation describe-stacks --stack-name ai-scribe-$STAGE $AWS_PROFILE_ARG >/dev/null 2>&1; then
    STACK_EXISTS=true
    echo -e "${BLUE}Stack 'ai-scribe-$STAGE' exists and will be updated${NC}"
else
    echo -e "${BLUE}Stack 'ai-scribe-$STAGE' does not exist and will be created${NC}"
fi
echo ""

# Clean build if requested
if [ "$CLEAN_BUILD" = true ]; then
    echo -e "${GREEN}Cleaning build artifacts...${NC}"
    rm -rf dist/ cdk.out/
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${GREEN}Installing dependencies...${NC}"
    npm install
fi

# Build TypeScript
echo -e "${GREEN}Building TypeScript...${NC}"
npm run build

# Run bootstrap if requested
if [ "$RUN_BOOTSTRAP" = true ]; then
    echo -e "${GREEN}Running CDK bootstrap...${NC}"
    cdk bootstrap aws://$ACCOUNT_ID/$REGION $AWS_PROFILE_ARG
fi

# Show diff if requested
if [ "$SHOW_DIFF" = true ] && [ "$STACK_EXISTS" = true ]; then
    echo -e "${GREEN}Showing stack differences...${NC}"
    cdk diff ai-scribe-$STAGE --context stage=$STAGE $AWS_PROFILE_ARG || true
    echo ""
    
    if [ "$FORCE_DEPLOY" != true ]; then
        read -p "Continue with deployment? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Deployment cancelled"
            exit 0
        fi
    fi
fi

# Synthesize only if requested
if [ "$SYNTH_ONLY" = true ]; then
    echo -e "${GREEN}Synthesizing CloudFormation template...${NC}"
    cdk synth ai-scribe-$STAGE --context stage=$STAGE $AWS_PROFILE_ARG
    echo -e "${GREEN}Synthesis complete!${NC}"
    exit 0
fi

# Deploy the stack
echo -e "${GREEN}Deploying stack ai-scribe-$STAGE...${NC}"

DEPLOY_CMD="cdk deploy ai-scribe-$STAGE --context stage=$STAGE"
if [ "$FORCE_DEPLOY" = true ]; then
    DEPLOY_CMD="$DEPLOY_CMD --require-approval never"
fi
if [ "$USE_HOTSWAP" = true ]; then
    DEPLOY_CMD="$DEPLOY_CMD --hotswap"
fi
if [ -n "$AWS_PROFILE_ARG" ]; then
    DEPLOY_CMD="$DEPLOY_CMD $AWS_PROFILE_ARG"
fi

eval $DEPLOY_CMD

# Show outputs if requested
if [ "$SHOW_OUTPUTS" = true ]; then
    echo ""
    echo -e "${GREEN}Stack Outputs:${NC}"
    aws cloudformation describe-stacks \
        --stack-name ai-scribe-$STAGE \
        --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
        --output table $AWS_PROFILE_ARG
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"

# Show helpful information
echo ""
echo -e "${YELLOW}Useful Commands:${NC}"
echo "  View outputs:  aws cloudformation describe-stacks --stack-name ai-scribe-$STAGE --query 'Stacks[0].Outputs'"
echo "  View logs:     cdk logs ai-scribe-$STAGE"
echo "  Destroy:       cdk destroy ai-scribe-$STAGE"
echo ""

# Check if secrets need to be updated
echo -e "${YELLOW}Remember to check:${NC}"
echo "  1. Deepgram API key in Secrets Manager"
echo "  2. Frontend environment variables"
echo "  3. CORS settings if frontend domain changed"