#!/bin/bash
# Backend Deployment Script - AWS CDK

echo "🚀 Deploying Backend via AWS CDK..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Navigate to CDK directory
cd infrastructure-cdk

# Run the deployment
./deploy.sh

echo ""
echo "✅ Backend deployment complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Next steps:"
echo "1. Copy the API Gateway URL from the output above"
echo "2. Update frontend/.env.local with the new URLs"
echo "3. Run ./deploy-frontend.sh"