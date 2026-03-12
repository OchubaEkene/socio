# Deployment Guide

This guide covers deploying the Socio application to production environments.

## 🚀 Deployment Options

### Frontend Deployment (Vercel)
### Backend Deployment (Railway/Render)
### Database (Neon/Supabase)

## 📋 Prerequisites

- **GitHub Account**: For repository hosting
- **Vercel Account**: For frontend deployment
- **Railway/Render Account**: For backend deployment
- **Neon/Supabase Account**: For PostgreSQL database

## 🗄️ Database Setup

### Option 1: Neon (Recommended)

1. **Create Neon Account**
   - Visit [neon.tech](https://neon.tech)
   - Sign up and create a new project

2. **Get Connection String**
   ```bash
   # Format: postgresql://user:password@host:port/database
   DATABASE_URL="postgresql://user:password@ep-xxx-xxx-xxx.region.aws.neon.tech/socio_db?sslmode=require"
   ```

3. **Run Migrations**
   ```bash
   cd backend
   npx prisma migrate deploy
   ```

### Option 2: Supabase

1. **Create Supabase Project**
   - Visit [supabase.com](https://supabase.com)
   - Create a new project

2. **Get Connection String**
   ```bash
   DATABASE_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"
   ```

3. **Run Migrations**
   ```bash
   cd backend
   npx prisma migrate deploy
   ```

## 🎯 Frontend Deployment (Vercel)

### 1. Prepare Frontend for Production

1. **Update Environment Variables**
   ```bash
   # frontend/.env.production
   VITE_API_URL="https://your-backend-domain.com/api"
   ```

2. **Build Locally (Optional)**
   ```bash
   cd frontend
   npm run build
   ```

### 2. Deploy to Vercel

#### Method 1: Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy from frontend directory
cd frontend
vercel --prod
```

#### Method 2: GitHub Integration
1. **Connect Repository**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Set root directory to `frontend`

2. **Configure Build Settings**
   ```json
   {
     "buildCommand": "npm run build",
     "outputDirectory": "dist",
     "installCommand": "npm install"
   }
   ```

3. **Set Environment Variables**
   - Go to Project Settings → Environment Variables
   - Add `VITE_API_URL` with your backend URL

### 3. Vercel Configuration

Create `vercel.json` in the frontend directory:
```json
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
  ]
}
```

## 🔧 Backend Deployment

### Option 1: Railway (Recommended)

1. **Create Railway Account**
   - Visit [railway.app](https://railway.app)
   - Connect your GitHub account

2. **Deploy Backend**
   ```bash
   # Install Railway CLI
   npm i -g @railway/cli

   # Login to Railway
   railway login

   # Initialize project
   cd backend
   railway init

   # Deploy
   railway up
   ```

3. **Set Environment Variables**
   ```bash
   railway variables set DATABASE_URL="your-neon-connection-string"
   railway variables set JWT_SECRET="your-super-secret-jwt-key"
   railway variables set NODE_ENV="production"
   railway variables set PORT="5001"
   railway variables set FRONTEND_URL="https://your-frontend-domain.vercel.app"
   ```

### Option 2: Render

1. **Create Render Account**
   - Visit [render.com](https://render.com)
   - Connect your GitHub account

2. **Create Web Service**
   - New → Web Service
   - Connect your repository
   - Set root directory to `backend`

3. **Configure Build Settings**
   ```bash
   Build Command: npm install && npm run build
   Start Command: npm start
   ```

4. **Set Environment Variables**
   - Go to Environment → Environment Variables
   - Add all required variables

### Option 3: Heroku

1. **Create Heroku App**
   ```bash
   # Install Heroku CLI
   # Create app
   heroku create your-socio-app

   # Add PostgreSQL
   heroku addons:create heroku-postgresql:mini
   ```

2. **Deploy**
   ```bash
   cd backend
   git add .
   git commit -m "Deploy to Heroku"
   git push heroku main
   ```

3. **Run Migrations**
   ```bash
   heroku run npx prisma migrate deploy
   ```

## 🔐 Environment Variables

### Production Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"

# Server
PORT=5001
NODE_ENV=production

# Authentication
JWT_SECRET="your-super-secret-jwt-key-production"

# Email (for notifications)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="noreply@yourdomain.com"

# Frontend URL (for CORS)
FRONTEND_URL="https://your-frontend-domain.vercel.app"

# Timezone
TZ="UTC"
```

## 📧 Email Configuration

### Gmail Setup
1. **Enable 2-Factor Authentication**
2. **Generate App Password**
   - Go to Google Account Settings
   - Security → App Passwords
   - Generate password for "Mail"

3. **Update Environment Variables**
   ```env
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT=587
   SMTP_USER="your-email@gmail.com"
   SMTP_PASS="your-16-character-app-password"
   SMTP_FROM="noreply@yourdomain.com"
   ```

### Alternative: SendGrid
```env
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT=587
SMTP_USER="apikey"
SMTP_PASS="your-sendgrid-api-key"
SMTP_FROM="noreply@yourdomain.com"
```

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm run install:all
      - run: npm run test

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd backend && npm install
      - run: cd backend && npm run build
      # Add deployment steps for your platform

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd frontend && npm install
      - run: cd frontend && npm run build
      # Add deployment steps for your platform
```

## 📊 Monitoring Setup

### 1. Sentry Error Tracking

#### Backend Setup
```bash
# Install Sentry
npm install @sentry/node @sentry/integrations

# backend/src/index.ts
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: "your-sentry-dsn",
  environment: process.env.NODE_ENV,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Express({ app }),
  ],
  tracesSampleRate: 1.0,
});

// Add error handling
app.use(Sentry.Handlers.errorHandler());
```

#### Frontend Setup
```bash
# Install Sentry
npm install @sentry/react

# frontend/src/main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "your-sentry-dsn",
  environment: import.meta.env.MODE,
  integrations: [
    new Sentry.BrowserTracing(),
  ],
  tracesSampleRate: 1.0,
});
```

### 2. Uptime Monitoring

#### UptimeRobot Setup
1. **Create Account**: [uptimerobot.com](https://uptimerobot.com)
2. **Add Monitor**:
   - **Type**: HTTP(s)
   - **URL**: `https://your-backend-domain.com/api/health`
   - **Interval**: 5 minutes
   - **Alert**: Email/Slack notification

#### Health Check Endpoint
```typescript
// backend/src/routes/health.ts
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});
```

### 3. Performance Monitoring

#### Backend Performance
```typescript
// Add performance monitoring
import morgan from 'morgan';

app.use(morgan('combined'));
```

#### Frontend Performance
```typescript
// Add performance monitoring
import { webVitals } from 'web-vitals';

webVitals(console.log);
```

## 🔒 Security Checklist

### Production Security
- [ ] **HTTPS Only**: All endpoints use HTTPS
- [ ] **CORS Configuration**: Proper CORS settings
- [ ] **Environment Variables**: No secrets in code
- [ ] **Database Security**: SSL connections enabled
- [ ] **Rate Limiting**: Implement rate limiting
- [ ] **Input Validation**: All inputs validated
- [ ] **SQL Injection**: Use parameterized queries (Prisma handles this)
- [ ] **XSS Protection**: Proper content security policies

### Security Headers
```typescript
// backend/src/index.ts
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
```

## 📈 Scaling Considerations

### Database Scaling
- **Connection Pooling**: Configure Prisma connection pool
- **Read Replicas**: Use read replicas for heavy read operations
- **Caching**: Implement Redis for caching

### Application Scaling
- **Load Balancing**: Use multiple instances
- **CDN**: Serve static assets via CDN
- **Caching**: Implement response caching

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Issues**
   ```bash
   # Check connection
   npx prisma db push
   
   # Reset database
   npx prisma migrate reset
   ```

2. **Build Failures**
   ```bash
   # Clear cache
   npm run clean
   
   # Reinstall dependencies
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Environment Variables**
   ```bash
   # Check environment variables
   echo $DATABASE_URL
   
   # Verify in deployment platform
   ```

### Logs and Debugging
```bash
# Backend logs
railway logs
# or
heroku logs --tail

# Frontend logs
vercel logs
```

## 📞 Support

For deployment issues:
1. Check platform-specific documentation
2. Review logs for error messages
3. Verify environment variables
4. Test locally with production settings

---

**Happy Deploying! 🚀**
