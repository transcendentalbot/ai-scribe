#!/bin/bash

echo "🔧 Setting environment variables for ai-scribe-sathya-dev..."

cd frontend

echo "Setting NEXT_PUBLIC_API_URL..."
echo "https://41h7fp3vk7.execute-api.us-east-1.amazonaws.com/prod/" | vercel env add NEXT_PUBLIC_API_URL production

echo "Setting NEXT_PUBLIC_WS_URL..."
echo "wss://861cq5e78g.execute-api.us-east-1.amazonaws.com/sathya-dev" | vercel env add NEXT_PUBLIC_WS_URL production

echo "Setting NEXT_PUBLIC_ENVIRONMENT..."
echo "sathya-dev" | vercel env add NEXT_PUBLIC_ENVIRONMENT production

echo "✅ Environment variables set!"
echo "🚀 Now deploying to production with environment variables..."

vercel --prod

echo "🎉 Deployment complete!"
echo "Your AI Scribe Sathya Dev environment is ready!"