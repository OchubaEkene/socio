#!/bin/bash

# Railway Backend Deployment Script
# Usage: ./scripts/deploy-railway.sh

set -e

echo "🚀 Starting Railway Backend Deployment..."

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

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    print_error "Railway CLI is not installed. Installing now..."
    npm install -g @railway/cli
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Navigate to backend directory
cd backend

print_status "Building backend for production..."

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
DATABASE_URL="your-neon-connection-string"
JWT_SECRET="your-super-secret-jwt-key-production"
NODE_ENV="production"
PORT="5001"
FRONTEND_URL="https://your-frontend-domain.vercel.app"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="noreply@yourdomain.com"
TZ="UTC"
EOF
    print_warning "Please update the environment variables in .env.production"
fi

# Check if railway.json exists
if [ ! -f "railway.json" ]; then
    print_status "Creating railway.json configuration..."
    cat > railway.json << EOF
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
EOF
fi

print_status "Initializing Railway project..."

# Initialize Railway project (if not already done)
if [ ! -f ".railway" ]; then
    railway init
fi

print_status "Setting environment variables..."

# Set environment variables (you'll need to update these with your actual values)
railway variables set NODE_ENV=production
railway variables set PORT=5001

print_warning "Please set the following environment variables manually:"
print_warning "1. DATABASE_URL - Your Neon/Supabase connection string"
print_warning "2. JWT_SECRET - Your JWT secret key"
print_warning "3. FRONTEND_URL - Your Vercel frontend URL"
print_warning "4. SMTP_* - Your email configuration"

print_status "Deploying to Railway..."

# Deploy to Railway
if railway up; then
    print_status "✅ Backend deployed successfully to Railway!"
    
    # Get the deployment URL
    DEPLOYMENT_URL=$(railway status --json | grep -o '"url":"[^"]*"' | cut -d'"' -f4)
    if [ ! -z "$DEPLOYMENT_URL" ]; then
        print_status "Your backend is available at: $DEPLOYMENT_URL"
    fi
else
    print_error "❌ Deployment failed!"
    exit 1
fi

print_status "Running database migrations..."

# Run database migrations
railway run npx prisma migrate deploy

print_status "✅ Database migrations completed!"

# Return to root directory
cd ..

print_status "🎉 Backend deployment completed!"
print_status "Don't forget to:"
print_status "1. Update your frontend VITE_API_URL to point to your Railway backend"
print_status "2. Set up all environment variables in Railway dashboard"
print_status "3. Configure your custom domain if needed"
print_status "4. Set up monitoring and logging"
