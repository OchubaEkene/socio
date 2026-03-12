#!/bin/bash

# Monitoring Setup Script
# Usage: ./scripts/setup-monitoring.sh

set -e

echo "📊 Setting up Monitoring and Error Tracking..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

print_header() {
    echo -e "${BLUE}[SETUP]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

print_header "Setting up Sentry Error Tracking"

# Backend Sentry Setup
print_status "Setting up Sentry for backend..."

cd backend

# Install Sentry dependencies
npm install @sentry/node @sentry/integrations

# Create Sentry configuration file
cat > src/sentry.ts << 'EOF'
import * as Sentry from "@sentry/node";
import { ProfilingIntegration } from "@sentry/profiling-node";

export function initSentry() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app: require('express')() }),
      new ProfilingIntegration(),
    ],
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  });
}

export { Sentry };
EOF

# Create health check route
cat > src/routes/health.ts << 'EOF'
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/health', async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      memory: process.memoryUsage(),
      database: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      database: 'disconnected'
    });
  }
});

export default router;
EOF

# Update main index.ts to include Sentry and health check
print_status "Updating backend main file to include monitoring..."

# Create a backup of the original index.ts
cp src/index.ts src/index.ts.backup

# Add Sentry import and initialization to index.ts
sed -i '' '1i\
import { initSentry } from "./sentry";\
import healthRoutes from "./routes/health";\
' src/index.ts

# Add Sentry initialization after dotenv config
sed -i '' '/dotenv.config();/a\
\
// Initialize Sentry\
initSentry();\
' src/index.ts

# Add health routes after other route imports
sed -i '' '/app.use.*\/api\/.*/a\
app.use("/api", healthRoutes);\
' src/index.ts

# Add Sentry error handler before the final error handler
sed -i '' '/app.use.*error.*/i\
// Sentry error handler\
app.use(Sentry.Handlers.errorHandler());\
' src/index.ts

cd ..

# Frontend Sentry Setup
print_status "Setting up Sentry for frontend..."

cd frontend

# Install Sentry dependencies
npm install @sentry/react

# Create Sentry configuration file
cat > src/sentry.ts << 'EOF'
import * as Sentry from "@sentry/react";

export function initSentry() {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      new Sentry.BrowserTracing({
        tracePropagationTargets: ["localhost", "your-domain.com"],
      }),
    ],
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
  });
}

export { Sentry };
EOF

# Update main.tsx to include Sentry
print_status "Updating frontend main file to include monitoring..."

# Create a backup of the original main.tsx
cp src/main.tsx src/main.tsx.backup

# Add Sentry import and initialization to main.tsx
sed -i '' '1i\
import { initSentry } from "./sentry";\
' src/main.tsx

# Add Sentry initialization before ReactDOM.render
sed -i '' '/ReactDOM.createRoot/a\
\
// Initialize Sentry\
initSentry();\
' src/main.tsx

cd ..

print_header "Setting up Environment Variables"

# Create environment variable templates
print_status "Creating environment variable templates..."

# Backend environment template
cat > backend/.env.monitoring << 'EOF'
# Sentry Configuration
SENTRY_DSN="your-sentry-dsn-here"

# Health Check Configuration
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_INTERVAL=30000

# Logging Configuration
LOG_LEVEL="info"
LOG_FORMAT="json"
EOF

# Frontend environment template
cat > frontend/.env.monitoring << 'EOF'
# Sentry Configuration
VITE_SENTRY_DSN="your-sentry-dsn-here"

# Performance Monitoring
VITE_PERFORMANCE_MONITORING=true
EOF

print_header "Setting up Uptime Monitoring"

# Create uptime monitoring configuration
cat > scripts/uptime-config.json << 'EOF'
{
  "monitors": [
    {
      "name": "Backend Health Check",
      "type": "http",
      "url": "https://your-backend-domain.com/api/health",
      "interval": 300,
      "timeout": 30,
      "expectedStatus": 200,
      "alerts": ["email", "slack"]
    },
    {
      "name": "Frontend Availability",
      "type": "http",
      "url": "https://your-frontend-domain.vercel.app",
      "interval": 300,
      "timeout": 30,
      "expectedStatus": 200,
      "alerts": ["email", "slack"]
    }
  ],
  "alerts": {
    "email": {
      "enabled": true,
      "recipients": ["admin@yourdomain.com"]
    },
    "slack": {
      "enabled": false,
      "webhook": "your-slack-webhook-url"
    }
  }
}
EOF

print_header "Creating Monitoring Scripts"

# Create monitoring scripts
cat > scripts/monitor-health.sh << 'EOF'
#!/bin/bash

# Health Check Monitoring Script
# Usage: ./scripts/monitor-health.sh

BACKEND_URL="${BACKEND_URL:-http://localhost:5001}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"

echo "🔍 Checking application health..."

# Check backend health
echo "Checking backend health..."
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/health")

if [ "$BACKEND_STATUS" = "200" ]; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend is unhealthy (Status: $BACKEND_STATUS)"
    # Send alert here
fi

# Check frontend availability
echo "Checking frontend availability..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL")

if [ "$FRONTEND_STATUS" = "200" ]; then
    echo "✅ Frontend is available"
else
    echo "❌ Frontend is unavailable (Status: $FRONTEND_STATUS)"
    # Send alert here
fi
EOF

chmod +x scripts/monitor-health.sh

print_header "Setting up Logging"

# Create logging configuration for backend
cat > backend/src/logger.ts << 'EOF'
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'socio-backend' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

export default logger;
EOF

print_status "Installing additional monitoring dependencies..."

cd backend
npm install winston
mkdir -p logs
cd ..

print_header "Creating Documentation"

# Create monitoring documentation
cat > MONITORING.md << 'EOF'
# Monitoring and Error Tracking Setup

## Overview
This document describes the monitoring setup for the Socio application.

## Components

### 1. Sentry Error Tracking
- **Backend**: Error tracking for Node.js/Express
- **Frontend**: Error tracking for React
- **Features**: Performance monitoring, error reporting, release tracking

### 2. Health Checks
- **Backend**: `/api/health` endpoint
- **Frontend**: Availability monitoring
- **Database**: Connection status monitoring

### 3. Logging
- **Backend**: Winston logger with file and console output
- **Format**: JSON in production, simple in development
- **Levels**: Error, warn, info, debug

## Setup Instructions

### 1. Sentry Setup
1. Create a Sentry account at [sentry.io](https://sentry.io)
2. Create a new project for your application
3. Get your DSN from the project settings
4. Update environment variables:
   ```bash
   # Backend
   SENTRY_DSN="your-sentry-dsn"
   
   # Frontend
   VITE_SENTRY_DSN="your-sentry-dsn"
   ```

### 2. Uptime Monitoring
1. Set up UptimeRobot or similar service
2. Configure monitors for:
   - Backend health: `https://your-backend.com/api/health`
   - Frontend availability: `https://your-frontend.com`
3. Set up alerts for downtime

### 3. Logging
1. Logs are automatically written to `backend/logs/`
2. Configure log rotation in production
3. Set up log aggregation (ELK stack, etc.)

## Environment Variables

### Backend
```env
SENTRY_DSN="your-sentry-dsn"
HEALTH_CHECK_ENABLED=true
LOG_LEVEL="info"
```

### Frontend
```env
VITE_SENTRY_DSN="your-sentry-dsn"
VITE_PERFORMANCE_MONITORING=true
```

## Monitoring Dashboard

### Key Metrics to Monitor
1. **Application Health**
   - Response time
   - Error rate
   - Uptime percentage

2. **Database Performance**
   - Connection pool usage
   - Query performance
   - Migration status

3. **User Experience**
   - Page load times
   - API response times
   - Error frequency

## Alerting

### Error Alerts
- Critical errors (Sentry)
- High error rates
- Database connection issues

### Performance Alerts
- Slow response times
- High memory usage
- Database performance issues

### Availability Alerts
- Service downtime
- Health check failures
- SSL certificate expiration

## Troubleshooting

### Common Issues
1. **Sentry not capturing errors**
   - Check DSN configuration
   - Verify environment variables
   - Check network connectivity

2. **Health checks failing**
   - Verify database connection
   - Check application logs
   - Validate environment configuration

3. **High error rates**
   - Review Sentry dashboard
   - Check application logs
   - Monitor database performance
EOF

print_status "✅ Monitoring setup completed!"

print_warning "Next steps:"
print_warning "1. Sign up for Sentry at https://sentry.io"
print_warning "2. Get your DSN and update environment variables"
print_warning "3. Set up UptimeRobot or similar uptime monitoring"
print_warning "4. Configure alerts for your team"
print_warning "5. Set up log aggregation for production"

print_status "📊 Monitoring is now configured for your application!"
