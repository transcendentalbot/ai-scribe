#!/bin/bash
# Frontend Deployment Script - Vercel

echo "🎨 Deploying Frontend to Vercel..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if .env.local exists
if [ ! -f frontend/.env.local ]; then
    echo "❌ Error: frontend/.env.local not found!"
    echo "Please create it with your backend URLs first."
    exit 1
fi

# Navigate to frontend
cd frontend

# Build the project
echo "📦 Building Next.js app..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed! Please fix errors and try again."
    exit 1
fi

# Deploy to Vercel
echo "🚀 Deploying to Vercel..."
# Make sure we're in the frontend directory
vercel --prod --cwd .

echo ""
echo "✅ Frontend deployment complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"