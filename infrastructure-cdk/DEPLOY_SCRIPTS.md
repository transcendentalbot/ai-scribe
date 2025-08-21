# CDK Deployment Scripts Guide

## Overview

We have a smart deployment system that automatically chooses the right deployment method:

### Smart Deploy (Recommended)
The `deploy-smart.sh` script automatically detects when to use simple vs advanced deployment based on:
- Whether new resources are being created
- If resources are being deleted
- Security/IAM changes
- Database modifications

```bash
npm run deploy              # Smart deploy (auto-detects mode)
npm run deploy -- dev       # Smart deploy to dev environment
npm run deploy -- --simple  # Force simple mode
npm run deploy -- --advanced # Force advanced mode
```

## Individual Scripts

We also have three deployment scripts for specific use cases:

### 1. `deploy.sh` (Main/Simple)
The default deployment script for regular updates to existing stacks.

```bash
./deploy.sh [STAGE] [SHOW_OUTPUTS]

# Examples:
./deploy.sh                    # Deploy to production
./deploy.sh dev                # Deploy to dev
./deploy.sh production true    # Deploy and show outputs
```

### 2. `deploy-advanced.sh` (Advanced)
Use this when you need more control, especially when:
- **Creating new resources** (use `-d` to preview changes)
- Working with multiple AWS profiles
- Need to see differences before deploying
- Want to use CDK hotswap for faster Lambda updates

```bash
./deploy-advanced.sh [OPTIONS] [STAGE]

# Examples:
./deploy-advanced.sh -d production        # Show diff before deploying
./deploy-advanced.sh -d -o production     # Show diff, deploy, then show outputs
./deploy-advanced.sh --hotswap dev        # Fast Lambda-only updates
./deploy-advanced.sh --profile prod-aws   # Use specific AWS profile
```

### 3. `deploy-old.sh` (Legacy)
The original script - kept for reference but should not be used as it:
- Creates secrets after deployment (can fail if they exist)
- Runs bootstrap every time
- Builds TypeScript twice

## When to Use Each Script

### Use `deploy.sh` when:
- Making routine updates to existing infrastructure
- Deploying bug fixes or minor changes
- You know exactly what you're deploying

### Use `deploy-advanced.sh` when:
- **Creating new AWS resources** (always use `-d` flag first)
- Need to preview changes before deploying
- Working with different AWS accounts/profiles
- Troubleshooting deployment issues
- Need clean builds or bootstrap

## NPM Commands

You can use npm commands for all deployment options:

```bash
npm run deploy                    # Smart deploy (auto-detects mode)
npm run deploy:simple             # Force simple deployment
npm run deploy:advanced -- -d     # Force advanced with diff
```

## How Smart Deploy Works

The smart deploy script will automatically use advanced mode when it detects:
1. **New Stack Creation**: Stack doesn't exist yet
2. **Resource Creation**: New AWS resources being added
3. **Resource Deletion**: Resources being removed
4. **Security Changes**: IAM roles, policies, or security groups
5. **Database Changes**: DynamoDB tables or other databases

Otherwise, it uses simple mode for faster deployment.

## Important Notes

1. **Stack Naming**: The stack name is `ai-scribe-${STAGE}` (e.g., `ai-scribe-production`)
2. **Default Stage**: If not specified, defaults to `production`
3. **No Bootstrap Needed**: CDK bootstrap is only needed once per account/region
4. **Secrets**: Secrets are now managed within the CDK stack, not created post-deployment

## Troubleshooting

If deployment creates a new stack instead of updating:
1. Check the stage name matches exactly (e.g., "production" not "prod")
2. Verify you're in the correct AWS account
3. Check region settings match