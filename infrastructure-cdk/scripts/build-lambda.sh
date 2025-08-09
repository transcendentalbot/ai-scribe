#!/bin/bash

# Build Lambda deployment packages without Docker

BACKEND_DIR="../backend"
LAMBDA_DIR="./lambda-dist"

# Clean and create lambda dist directory
rm -rf $LAMBDA_DIR
mkdir -p $LAMBDA_DIR/auth

# Build backend if not already built
cd $BACKEND_DIR
npm run build
cd -

# Copy built handlers
cp -r $BACKEND_DIR/dist/handlers/auth/* $LAMBDA_DIR/auth/

# Copy node_modules (only production dependencies)
cd $BACKEND_DIR
npm ci --production
cd -

# Create deployment packages for each handler
for handler in register login logout refresh me forgot-password confirm-forgot-password; do
  echo "Creating deployment package for $handler..."
  
  mkdir -p $LAMBDA_DIR/auth-$handler
  
  # Copy handler
  cp $LAMBDA_DIR/auth/$handler.js $LAMBDA_DIR/auth-$handler/
  
  # Copy utilities
  cp -r $BACKEND_DIR/dist/utils $LAMBDA_DIR/auth-$handler/
  cp -r $BACKEND_DIR/dist/types $LAMBDA_DIR/auth-$handler/
  
  # Copy node_modules
  cp -r $BACKEND_DIR/node_modules $LAMBDA_DIR/auth-$handler/
  
  # Create zip
  cd $LAMBDA_DIR/auth-$handler
  zip -rq ../auth-$handler.zip .
  cd -
  
  # Clean up
  rm -rf $LAMBDA_DIR/auth-$handler
done

echo "Lambda deployment packages created successfully!"