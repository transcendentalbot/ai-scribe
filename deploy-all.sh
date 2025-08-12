#!/bin/bash
# Full Stack Deployment Script - Backend (CDK) + Frontend (Vercel)

echo "🚀 FULL STACK DEPLOYMENT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "This will deploy:"
echo "  • Backend: AWS CDK (Lambda, API Gateway, DynamoDB, etc.)"
echo "  • Frontend: Vercel (Next.js from frontend folder)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Deploy Backend
echo "📦 STEP 1: Deploying Backend via AWS CDK..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd infrastructure-cdk
./deploy.sh prod us-east-1

if [ $? -ne 0 ]; then
    echo "❌ Backend deployment failed! Please fix errors and try again."
    exit 1
fi

echo ""
echo "✅ Backend deployment complete!"
echo ""

# Check if frontend env file exists
if [ ! -f ../frontend/.env.local ]; then
    echo "⚠️  WARNING: frontend/.env.local not found!"
    echo "Please create it with your backend URLs before continuing."
    echo ""
    echo "Required environment variables:"
    echo "  NEXT_PUBLIC_API_URL=<your-api-gateway-url>"
    echo "  NEXT_PUBLIC_WS_URL=<your-websocket-url>"
    echo "  NEXT_PUBLIC_USER_POOL_ID=<your-cognito-pool-id>"
    echo "  NEXT_PUBLIC_USER_POOL_CLIENT_ID=<your-cognito-client-id>"
    echo ""
    read -p "Press Enter to continue with frontend deployment anyway, or Ctrl+C to exit..."
fi

# Deploy Frontend
echo ""
echo "📦 STEP 2: Deploying Frontend to Vercel..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd ../frontend

# Build the project
echo "Building Next.js application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Frontend build failed! Please fix errors and try again."
    exit 1
fi

# Deploy to Vercel (from frontend directory)
echo "Deploying to Vercel from frontend directory..."
vercel --prod --cwd .

if [ $? -ne 0 ]; then
    echo "❌ Frontend deployment failed!"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ FULL STACK DEPLOYMENT COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Deployment Summary:"
echo "  • Backend: Deployed to AWS via CDK"
echo "  • Frontend: Deployed to Vercel from frontend folder"
echo ""
echo "Next steps:"
echo "1. Test your API endpoints"
echo "2. Verify the frontend is working correctly"
echo "3. Check CloudWatch logs if you encounter issues"