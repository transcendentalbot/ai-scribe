#!/bin/bash

# AI Scribe Infrastructure Destruction Script
# This script safely removes the AI Scribe infrastructure

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
STAGE=${1:-dev}
PROFILE=${2:-default}

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

# Confirm destruction
confirm_destruction() {
    print_warning "This will destroy the AI Scribe infrastructure for stage: $STAGE"
    print_warning "This action cannot be undone!"
    echo ""
    read -p "Are you sure you want to continue? Type 'yes' to confirm: " -r
    echo ""
    if [[ ! $REPLY == "yes" ]]; then
        print_status "Destruction cancelled."
        exit 0
    fi
}

# Empty S3 buckets
empty_s3_buckets() {
    local account_id=$(aws sts get-caller-identity --profile "$PROFILE" --query Account --output text)
    local stack_name="ai-scribe-${STAGE}"
    
    print_status "Emptying S3 buckets..."
    
    # Get bucket names from stack
    local audio_bucket=$(aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query "Stacks[0].Outputs[?OutputKey=='AudioBucketName'].OutputValue" \
        --output text \
        --profile "$PROFILE" 2>/dev/null || echo "")
    
    if [[ -n "$audio_bucket" ]]; then
        print_status "Emptying audio bucket: $audio_bucket"
        aws s3 rm "s3://${audio_bucket}" --recursive --profile "$PROFILE" || true
        
        # Delete all versions if versioning is enabled
        aws s3api delete-objects \
            --bucket "$audio_bucket" \
            --delete "$(aws s3api list-object-versions \
                --bucket "$audio_bucket" \
                --output json \
                --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}' \
                --profile "$PROFILE")" \
            --profile "$PROFILE" 2>/dev/null || true
    fi
    
    # Empty deployment bucket
    local deployment_bucket="ai-scribe-sam-deployments-${STAGE}-${account_id}"
    if aws s3 ls "s3://${deployment_bucket}" --profile "$PROFILE" 2>&1 | grep -q 'NoSuchBucket'; then
        print_status "Deployment bucket doesn't exist."
    else
        print_status "Emptying deployment bucket: $deployment_bucket"
        aws s3 rm "s3://${deployment_bucket}" --recursive --profile "$PROFILE" || true
    fi
}

# Delete secrets
delete_secrets() {
    local stack_name="ai-scribe-${STAGE}"
    
    print_status "Deleting secrets..."
    
    # Delete JWT secret
    aws secretsmanager delete-secret \
        --secret-id "${stack_name}-jwt-secret" \
        --force-delete-without-recovery \
        --profile "$PROFILE" 2>/dev/null || true
    
    # Delete Deepgram secret
    aws secretsmanager delete-secret \
        --secret-id "${stack_name}-deepgram" \
        --force-delete-without-recovery \
        --profile "$PROFILE" 2>/dev/null || true
    
    # Delete OpenAI secret
    aws secretsmanager delete-secret \
        --secret-id "${stack_name}-openai" \
        --force-delete-without-recovery \
        --profile "$PROFILE" 2>/dev/null || true
}

# Delete CloudFormation stack
delete_stack() {
    local stack_name="ai-scribe-${STAGE}"
    
    print_status "Deleting CloudFormation stack: $stack_name"
    
    aws cloudformation delete-stack \
        --stack-name "$stack_name" \
        --profile "$PROFILE"
    
    print_status "Waiting for stack deletion to complete..."
    aws cloudformation wait stack-delete-complete \
        --stack-name "$stack_name" \
        --profile "$PROFILE" || true
}

# Delete deployment bucket
delete_deployment_bucket() {
    local account_id=$(aws sts get-caller-identity --profile "$PROFILE" --query Account --output text)
    local deployment_bucket="ai-scribe-sam-deployments-${STAGE}-${account_id}"
    
    if aws s3 ls "s3://${deployment_bucket}" --profile "$PROFILE" 2>&1 | grep -q 'NoSuchBucket'; then
        print_status "Deployment bucket doesn't exist."
    else
        print_status "Deleting deployment bucket: $deployment_bucket"
        aws s3 rb "s3://${deployment_bucket}" --force --profile "$PROFILE"
    fi
}

# Main destruction flow
main() {
    print_status "Starting AI Scribe infrastructure destruction..."
    print_status "Stage: $STAGE"
    print_status "Profile: $PROFILE"
    
    # Confirm destruction
    confirm_destruction
    
    # Empty S3 buckets
    empty_s3_buckets
    
    # Delete secrets
    delete_secrets
    
    # Delete CloudFormation stack
    delete_stack
    
    # Delete deployment bucket
    delete_deployment_bucket
    
    # Remove environment file
    rm -f "environments/${STAGE}.env"
    
    print_status "Infrastructure destruction completed successfully!"
}

# Run main function
main