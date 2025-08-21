#!/bin/bash

# AI Scribe Frontend Deployment - Sathya Dev Environment
# One-command deployment script

set -e

cd frontend

echo "🚀 Deploying AI Scribe Frontend - Sathya Dev Environment"
echo "=================================================="

# Check if logged in
echo "📋 Checking Vercel authentication..."
if ! vercel whoami >/dev/null 2>&1; then
    echo "❌ Not logged in to Vercel"
    echo "🔐 Please login first:"
    vercel login
fi

echo "✅ Vercel authentication confirmed"

# Deploy to separate project
echo "🏗️  Deploying to separate project: ai-scribe-sathya-dev"
vercel --name ai-scribe-sathya-dev --yes

# Set environment variables
echo "🔧 Setting environment variables..."

echo "Setting API URL..."
echo "https://41h7fp3vk7.execute-api.us-east-1.amazonaws.com/prod/" | vercel env add NEXT_PUBLIC_API_URL

echo "Setting WebSocket URL..."
echo "wss://861cq5e78g.execute-api.us-east-1.amazonaws.com/sathya-dev" | vercel env add NEXT_PUBLIC_WS_URL

echo "Setting environment name..."
echo "sathya-dev" | vercel env add NEXT_PUBLIC_ENVIRONMENT

# Deploy to production with environment variables
echo "🚀 Deploying to production with environment variables..."
vercel --prod --yes

echo "✅ Deployment Complete!"
echo "=================================================="
echo "🎉 Your AI Scribe Sathya Dev environment is ready!"
echo ""
echo "Frontend URL: Check the output above for your Vercel URL"
echo "Backend API: https://41h7fp3vk7.execute-api.us-east-1.amazonaws.com/prod/"
echo "WebSocket: wss://861cq5e78g.execute-api.us-east-1.amazonaws.com/sathya-dev"
echo "Model: Claude 3.5 Sonnet v2 (Best for medical documentation)"
echo ""
echo "🧪 Ready to test complete SOAP notes workflow!"