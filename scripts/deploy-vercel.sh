#!/bin/bash

# Vercel Frontend Deployment Script
# Usage: ./scripts/deploy-vercel.sh

set -e

echo "🚀 Starting Vercel Frontend Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    print_error "Vercel CLI is not installed. Installing now..."
    npm install -g vercel
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Navigate to frontend directory
cd frontend

print_status "Building frontend for production..."

# Install dependencies
npm install

# Build the application
npm run build

print_status "Build completed successfully!"

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    print_warning ".env.production not found. Creating from template..."
    cat > .env.production << EOF
# Production environment variables
VITE_API_URL="https://your-backend-domain.com/api"
EOF
    print_warning "Please update VITE_API_URL in .env.production with your actual backend URL"
fi

# Check if vercel.json exists
if [ ! -f "vercel.json" ]; then
    print_status "Creating vercel.json configuration..."
    cat > vercel.json << EOF
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        }
      ]
    }
  ],
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install"
}
EOF
fi

print_status "Deploying to Vercel..."

# Deploy to Vercel
if vercel --prod --yes; then
    print_status "✅ Frontend deployed successfully to Vercel!"
    print_status "Your application should be available at the URL shown above"
else
    print_error "❌ Deployment failed!"
    exit 1
fi

# Return to root directory
cd ..

print_status "🎉 Frontend deployment completed!"
print_status "Don't forget to:"
print_status "1. Update your backend CORS settings to allow your Vercel domain"
print_status "2. Set up environment variables in Vercel dashboard"
print_status "3. Configure your custom domain if needed"
