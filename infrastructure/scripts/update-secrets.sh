#!/bin/bash

# AI Scribe Secrets Update Script
# This script helps update API keys and secrets

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

# Update Deepgram API key
update_deepgram_key() {
    local stack_name="ai-scribe-${STAGE}"
    
    print_status "Updating Deepgram API key..."
    echo -n "Enter your Deepgram API key: "
    read -s deepgram_key
    echo ""
    
    if [[ -z "$deepgram_key" ]]; then
        print_error "Deepgram API key cannot be empty"
        return 1
    fi
    
    aws secretsmanager update-secret \
        --secret-id "${stack_name}-deepgram" \
        --secret-string "{\"api-key\":\"${deepgram_key}\"}" \
        --profile "$PROFILE"
    
    print_status "Deepgram API key updated successfully."
}

# Update Bedrock model configuration
update_bedrock_model() {
    local stack_name="ai-scribe-${STAGE}"
    
    print_status "Updating Bedrock model configuration..."
    echo "Available models:"
    echo "1. Claude 3 Sonnet (anthropic.claude-3-sonnet-20240229-v1:0)"
    echo "2. Claude 3 Haiku (anthropic.claude-3-haiku-20240307-v1:0)"
    echo "3. Claude 2.1 (anthropic.claude-v2:1)"
    echo "4. Llama 2 70B (meta.llama2-70b-chat-v1)"
    echo ""
    echo -n "Select model (1-4) or enter custom model ID: "
    read model_choice
    
    case $model_choice in
        1) model_id="anthropic.claude-3-sonnet-20240229-v1:0" ;;
        2) model_id="anthropic.claude-3-haiku-20240307-v1:0" ;;
        3) model_id="anthropic.claude-v2:1" ;;
        4) model_id="meta.llama2-70b-chat-v1" ;;
        *) model_id="$model_choice" ;;
    esac
    
    aws ssm put-parameter \
        --name "/${stack_name}/bedrock-model-id" \
        --value "$model_id" \
        --type String \
        --overwrite \
        --profile "$PROFILE"
    
    print_status "Bedrock model updated to: $model_id"
}

# Update JWT secret
update_jwt_secret() {
    local stack_name="ai-scribe-${STAGE}"
    
    print_status "Updating JWT secret..."
    print_warning "This will invalidate all existing JWT tokens!"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        local new_secret=$(openssl rand -base64 32)
        
        aws secretsmanager update-secret \
            --secret-id "${stack_name}-jwt-secret" \
            --secret-string "{\"secret\":\"${new_secret}\"}" \
            --profile "$PROFILE"
        
        print_status "JWT secret updated successfully."
    else
        print_status "JWT secret update cancelled."
    fi
}

# Main menu
show_menu() {
    echo ""
    echo "AI Scribe Secrets Manager"
    echo "========================="
    echo "Stage: $STAGE"
    echo "Profile: $PROFILE"
    echo ""
    echo "1. Update Deepgram API key"
    echo "2. Update Bedrock model configuration"
    echo "3. Update JWT secret"
    echo "4. Update all secrets"
    echo "5. Exit"
    echo ""
    echo -n "Select an option (1-5): "
}

# Main function
main() {
    print_status "AI Scribe Secrets Manager"
    
    while true; do
        show_menu
        read -r choice
        
        case $choice in
            1)
                update_deepgram_key
                ;;
            2)
                update_bedrock_model
                ;;
            3)
                update_jwt_secret
                ;;
            4)
                update_deepgram_key
                update_bedrock_model
                read -p "Do you also want to update the JWT secret? (y/N): " -n 1 -r
                echo ""
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    update_jwt_secret
                fi
                ;;
            5)
                print_status "Exiting..."
                exit 0
                ;;
            *)
                print_error "Invalid option. Please select 1-5."
                ;;
        esac
    done
}

# Run main function
main