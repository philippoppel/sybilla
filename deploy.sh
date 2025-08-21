#!/bin/bash

# Auto-deployment script for Sybilla website
# This script handles git operations and deployment to Vercel

set -e  # Exit on any error

echo "🚀 Starting deployment process..."

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Not a git repository. Initializing..."
    git init
    git remote add origin https://github.com/your-username/sybilla-website.git
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "📝 Found uncommitted changes..."
    
    # Add all changes
    git add .
    
    # Create commit with timestamp
    COMMIT_MESSAGE="Update website content - $(date '+%Y-%m-%d %H:%M:%S')"
    git commit -m "$COMMIT_MESSAGE"
    
    echo "✅ Changes committed: $COMMIT_MESSAGE"
else
    echo "ℹ️  No changes to commit"
fi

# Push to remote repository
echo "📤 Pushing to remote repository..."
git push origin main

# If Vercel CLI is available, trigger deployment
if command -v vercel &> /dev/null; then
    echo "🌐 Deploying to Vercel..."
    vercel --prod
    echo "✅ Deployed to Vercel successfully!"
else
    echo "ℹ️  Vercel CLI not found. Auto-deployment will be handled by git hooks."
fi

echo "🎉 Deployment process completed!"
echo "🌍 Your website will be live in a few minutes at: https://your-domain.vercel.app"