#!/bin/bash

# AI Scribe Infrastructure Deployment Script
# This script handles the deployment of the AI Scribe infrastructure

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
STAGE=${1:-dev}
REGION=${2:-us-east-1}
PROFILE=${3:-default}

# Function to print colored output
print_status() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

# Validate prerequisites
validate_prerequisites() {
    print_status "Validating prerequisites..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI not found. Please install AWS CLI."
        exit 1
    fi
    
    # Check SAM CLI
    if ! command -v sam &> /dev/null; then
        print_error "SAM CLI not found. Please install SAM CLI."
        exit 1
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js not found. Please install Node.js 20.x."
        exit 1
    fi
    
    # Validate AWS credentials
    if ! aws sts get-caller-identity --profile "$PROFILE" &> /dev/null; then
        print_error "Invalid AWS credentials for profile: $PROFILE"
        exit 1
    fi
    
    print_status "Prerequisites validated successfully."
}

# Create S3 bucket for SAM deployments
create_deployment_bucket() {
    local account_id=$(aws sts get-caller-identity --profile "$PROFILE" --query Account --output text)
    local bucket_name="ai-scribe-sam-deployments-${STAGE}-${account_id}"
    
    print_status "Checking deployment bucket: $bucket_name"
    
    if ! aws s3 ls "s3://${bucket_name}" --profile "$PROFILE" 2>&1 | grep -q 'NoSuchBucket'; then
        print_status "Deployment bucket already exists."
    else
        print_status "Creating deployment bucket..."
        aws s3 mb "s3://${bucket_name}" --region "$REGION" --profile "$PROFILE"
        
        # Enable versioning
        aws s3api put-bucket-versioning \
            --bucket "$bucket_name" \
            --versioning-configuration Status=Enabled \
            --profile "$PROFILE"
        
        # Enable encryption
        aws s3api put-bucket-encryption \
            --bucket "$bucket_name" \
            --server-side-encryption-configuration '{"Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]}' \
            --profile "$PROFILE"
        
        # Block public access
        aws s3api put-public-access-block \
            --bucket "$bucket_name" \
            --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
            --profile "$PROFILE"
    fi
    
    echo "$bucket_name"
}

# Build Lambda layers
build_layers() {
    print_status "Building Lambda layers..."
    
    # Create layers directory if it doesn't exist
    mkdir -p layers/common/nodejs
    
    # Create package.json for common layer
    cat > layers/common/nodejs/package.json <<EOF
{
  "name": "ai-scribe-common-layer",
  "version": "1.0.0",
  "description": "Common dependencies for AI Scribe Lambda functions",
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.0.0",
    "@aws-sdk/lib-dynamodb": "^3.0.0",
    "@aws-sdk/client-s3": "^3.0.0",
    "@aws-sdk/client-cognito-identity-provider": "^3.0.0",
    "@aws-sdk/client-ses": "^3.0.0",
    "@aws-sdk/client-cloudwatch": "^3.0.0",
    "@aws-sdk/client-eventbridge": "^3.0.0",
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.3",
    "uuid": "^9.0.0",
    "zlib": "^1.0.5"
  }
}
EOF
    
    # Install dependencies
    cd layers/common/nodejs
    npm install --production
    cd ../../..
    
    print_status "Lambda layers built successfully."
}

# Deploy infrastructure
deploy_infrastructure() {
    local deployment_bucket=$1
    local stack_name="ai-scribe-${STAGE}"
    
    print_status "Deploying infrastructure stack: $stack_name"
    
    # Validate template
    print_status "Validating SAM template..."
    sam validate --template template.yaml --profile "$PROFILE"
    
    # Build
    print_status "Building SAM application..."
    sam build --template template.yaml --profile "$PROFILE"
    
    # Deploy
    print_status "Deploying to AWS..."
    sam deploy \
        --template-file .aws-sam/build/template.yaml \
        --stack-name "$stack_name" \
        --s3-bucket "$deployment_bucket" \
        --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND CAPABILITY_NAMED_IAM \
        --parameter-overrides \
            Stage="$STAGE" \
            AlertEmail="${ALERT_EMAIL:-alerts@healthspaceai.com}" \
        --profile "$PROFILE" \
        --region "$REGION" \
        --no-confirm-changeset \
        --tags \
            Environment="$STAGE" \
            Project="AI-Scribe" \
            ManagedBy="SAM" \
            HIPAA="true"
    
    print_status "Infrastructure deployed successfully."
}

# Create secrets
create_secrets() {
    local stack_name="ai-scribe-${STAGE}"
    
    print_status "Creating secrets in Secrets Manager..."
    
    # JWT Secret
    if ! aws secretsmanager describe-secret --secret-id "${stack_name}-jwt-secret" --profile "$PROFILE" 2>/dev/null; then
        print_status "Creating JWT secret..."
        aws secretsmanager create-secret \
            --name "${stack_name}-jwt-secret" \
            --description "JWT signing secret for AI Scribe" \
            --secret-string "{\"secret\":\"$(openssl rand -base64 32)\"}" \
            --profile "$PROFILE"
    else
        print_status "JWT secret already exists."
    fi
    
    # Deepgram API Key (placeholder)
    if ! aws secretsmanager describe-secret --secret-id "${stack_name}-deepgram" --profile "$PROFILE" 2>/dev/null; then
        print_status "Creating Deepgram API key secret..."
        print_warning "Please update this secret with your actual Deepgram API key"
        aws secretsmanager create-secret \
            --name "${stack_name}-deepgram" \
            --description "Deepgram API key for transcription" \
            --secret-string "{\"api-key\":\"YOUR_DEEPGRAM_API_KEY\"}" \
            --profile "$PROFILE"
    else
        print_status "Deepgram secret already exists."
    fi
    
    # Bedrock is configured via IAM roles - no API key needed
    print_status "AWS Bedrock will be used for note generation (no API key required)"
}

# Output deployment information
output_deployment_info() {
    local stack_name="ai-scribe-${STAGE}"
    
    print_status "Fetching deployment outputs..."
    
    # Get stack outputs
    local api_url=$(aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
        --output text \
        --profile "$PROFILE" 2>/dev/null || echo "N/A")
    
    local websocket_url=$(aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query "Stacks[0].Outputs[?OutputKey=='WebSocketUrl'].OutputValue" \
        --output text \
        --profile "$PROFILE" 2>/dev/null || echo "N/A")
    
    local user_pool_id=$(aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
        --output text \
        --profile "$PROFILE" 2>/dev/null || echo "N/A")
    
    local user_pool_client_id=$(aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" \
        --output text \
        --profile "$PROFILE" 2>/dev/null || echo "N/A")
    
    print_status "=========================================="
    print_status "Deployment Summary"
    print_status "=========================================="
    echo "Stage: $STAGE"
    echo "Region: $REGION"
    echo "Stack Name: $stack_name"
    echo ""
    echo "API URL: $api_url"
    echo "WebSocket URL: $websocket_url"
    echo "User Pool ID: $user_pool_id"
    echo "User Pool Client ID: $user_pool_client_id"
    echo ""
    print_status "=========================================="
    
    # Save to environment file
    cat > "environments/${STAGE}.env" <<EOF
# AI Scribe Environment Configuration - ${STAGE}
# Generated on $(date)

STAGE=${STAGE}
REGION=${REGION}
API_URL=${api_url}
WEBSOCKET_URL=${websocket_url}
USER_POOL_ID=${user_pool_id}
USER_POOL_CLIENT_ID=${user_pool_client_id}
EOF
    
    print_status "Environment configuration saved to environments/${STAGE}.env"
}

# Main deployment flow
main() {
    print_status "Starting AI Scribe infrastructure deployment..."
    print_status "Stage: $STAGE"
    print_status "Region: $REGION"
    print_status "Profile: $PROFILE"
    
    # Validate prerequisites
    validate_prerequisites
    
    # Create deployment bucket
    deployment_bucket=$(create_deployment_bucket)
    
    # Build layers
    build_layers
    
    # Deploy infrastructure
    deploy_infrastructure "$deployment_bucket"
    
    # Create secrets
    create_secrets
    
    # Output deployment information
    output_deployment_info
    
    print_status "Deployment completed successfully!"
    print_warning "Remember to:"
    print_warning "1. Update the Deepgram and OpenAI API keys in Secrets Manager"
    print_warning "2. Verify email address in SES for sending notifications"
    print_warning "3. Update Cognito callback URLs with your frontend domain"
}

# Run main function
main