#!/bin/bash

# AI Scribe Smart Deploy Script - Automatically chooses between simple and advanced deployment

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Parse arguments
STAGE=${1:-production}
FORCE_SIMPLE=false
FORCE_ADVANCED=false

# Check for force flags
for arg in "$@"; do
    case $arg in
        --simple)
            FORCE_SIMPLE=true
            ;;
        --advanced)
            FORCE_ADVANCED=true
            ;;
    esac
done

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}AI Scribe Smart Deploy${NC}"
echo -e "${GREEN}========================================${NC}"
echo "Stage: $STAGE"
echo ""

# Check if we're forced to use a specific mode
if [ "$FORCE_SIMPLE" = true ]; then
    echo -e "${BLUE}Using simple deployment (forced)${NC}"
    exec ./deploy.sh "$@"
elif [ "$FORCE_ADVANCED" = true ]; then
    echo -e "${BLUE}Using advanced deployment (forced)${NC}"
    # Remove the --advanced flag before passing to deploy-advanced.sh
    args=("$@")
    filtered_args=()
    for arg in "${args[@]}"; do
        if [ "$arg" != "--advanced" ]; then
            filtered_args+=("$arg")
        fi
    done
    exec ./deploy-advanced.sh "${filtered_args[@]}"
fi

# Auto-detect if we should use advanced mode
echo -e "${YELLOW}Analyzing deployment requirements...${NC}"

# Check if CDK is installed
if ! command -v cdk &> /dev/null; then
    echo -e "${RED}Error: AWS CDK is not installed${NC}"
    echo "Install with: npm install -g aws-cdk"
    exit 1
fi

# Build first to ensure we can synthesize
echo -e "${GREEN}Building TypeScript...${NC}"
npm run build

# Synthesize to check for changes
echo -e "${GREEN}Checking for infrastructure changes...${NC}"
SYNTH_OUTPUT=$(cdk synth ai-scribe-$STAGE --context stage=$STAGE 2>&1)

# Check if stack exists
STACK_EXISTS=false
if aws cloudformation describe-stacks --stack-name ai-scribe-$STAGE >/dev/null 2>&1; then
    STACK_EXISTS=true
fi

# Detect if there are significant changes
USE_ADVANCED=false
REASONS=()

# If stack doesn't exist, use advanced
if [ "$STACK_EXISTS" = false ]; then
    USE_ADVANCED=true
    REASONS+=("Stack does not exist - will be created")
fi

# Check for resource changes using cdk diff
if [ "$STACK_EXISTS" = true ]; then
    echo -e "${GREEN}Checking for resource changes...${NC}"
    DIFF_OUTPUT=$(cdk diff ai-scribe-$STAGE --context stage=$STAGE 2>&1 || true)
    
    # Check for new resources
    if echo "$DIFF_OUTPUT" | grep -q "Resources.*to be created"; then
        USE_ADVANCED=true
        REASONS+=("New resources will be created")
    fi
    
    # Check for resource deletions
    if echo "$DIFF_OUTPUT" | grep -q "Resources.*to be deleted"; then
        USE_ADVANCED=true
        REASONS+=("Resources will be deleted")
    fi
    
    # Check for security changes
    if echo "$DIFF_OUTPUT" | grep -E -q "(IAM|Security|Policy|Role)"; then
        USE_ADVANCED=true
        REASONS+=("Security/IAM changes detected")
    fi
    
    # Check for database changes
    if echo "$DIFF_OUTPUT" | grep -E -q "(Table|Database|DynamoDB)"; then
        USE_ADVANCED=true
        REASONS+=("Database changes detected")
    fi
fi

# Make decision
echo ""
if [ "$USE_ADVANCED" = true ]; then
    echo -e "${BLUE}Using ADVANCED deployment mode${NC}"
    echo -e "${YELLOW}Reasons:${NC}"
    for reason in "${REASONS[@]}"; do
        echo "  - $reason"
    done
    echo ""
    echo -e "${YELLOW}Advanced mode will show you a diff before deploying${NC}"
    echo ""
    
    # Use advanced script with diff flag
    exec ./deploy-advanced.sh -d "$@"
else
    echo -e "${BLUE}Using SIMPLE deployment mode${NC}"
    echo -e "${GREEN}Only minor changes detected - proceeding with simple deployment${NC}"
    echo ""
    
    # Use simple script
    exec ./deploy.sh "$@"
fi