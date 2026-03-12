# Socio - Staff Scheduling Management System

A full-stack web application for managing staff schedules, built with React, Node.js, Express, PostgreSQL, and TypeScript.

## 🚀 Features

- **Staff Management**: Add, edit, and manage staff members with qualifications
- **Rule-Based Scheduling**: Create scheduling rules with gender preferences and qualification requirements
- **Automated Scheduling**: AI-powered schedule generation with fairness algorithms
- **Manual Schedule Editing**: Drag-and-drop interface for manual schedule adjustments
- **Availability Tracking**: Staff can submit their availability for shifts
- **Email Notifications**: Automated reminders and schedule summaries
- **Reporting**: Comprehensive reports on staff performance and shift distribution
- **Exception Handling**: Track and resolve scheduling conflicts and exceptions

## 🛠️ Tech Stack
s
### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **React Router** for navigation
- **React Query** for data fetching
- **React Hook Form** with Zod validation
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **React Hot Toast** for notifications

### Backend
- **Node.js** with TypeScript
- **Express.js** for API server
- **PostgreSQL** database
- **Prisma ORM** for database management
- **JWT** for authentication
- **Nodemailer** for email notifications
- **Node-cron** for scheduled tasks

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (v18 or higher)
- **npm** (v8 or higher)
- **PostgreSQL** (v13 or higher)
- **Git**

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd socio
```

### 2. Install Dependencies

```bash
# Install all dependencies (root, backend, and frontend)
npm run install:all
```

### 3. Set Up the Database

1. **Create a PostgreSQL database:**
   ```bash
   createdb socio_db
   ```

2. **Configure environment variables:**
   ```bash
   # Copy the example environment file
   cp backend/env.example backend/.env
   ```

3. **Update the database URL in `backend/.env`:**
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/socio_db"
   JWT_SECRET="your-super-secret-jwt-key"
   PORT=5001
   ```

4. **Run database migrations:**
   ```bash
   cd backend
   npm run db:generate
   npm run db:migrate
   ```

### 4. Start the Development Servers

```bash
# Start both backend and frontend servers
npm run dev
```

This will start:
- **Backend**: http://localhost:5001
- **Frontend**: http://localhost:5173
- **Prisma Studio**: http://localhost:5555 (optional)

### 5. Access the Application

Open your browser and navigate to:
- **Main Application**: http://localhost:5173
- **API Documentation**: http://localhost:5001/api/health

## 📁 Project Structure

```
socio/
├── backend/                 # Backend API server
│   ├── src/
│   │   ├── routes/         # API route handlers
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Express middleware
│   │   └── index.ts        # Server entry point
│   ├── prisma/             # Database schema and migrations
│   └── package.json
├── frontend/               # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable React components
│   │   ├── pages/          # Page components
│   │   ├── lib/            # Utilities and API clients
│   │   └── App.tsx         # Main app component
│   └── package.json
├── package.json            # Root package.json (monorepo)
└── README.md
```

## 🔧 Development

### Available Scripts

#### Root Level
```bash
npm run dev              # Start both backend and frontend
npm run build            # Build both applications
npm run test             # Run all tests
npm run install:all      # Install dependencies for all packages
```

#### Backend
```bash
cd backend
npm run dev              # Start development server with hot reload
npm run build            # Build for production
npm run start            # Start production server
npm run test             # Run backend tests
npm run db:migrate       # Run database migrations
npm run db:studio        # Open Prisma Studio
```

#### Frontend
```bash
cd frontend
npm run dev              # Start development server
npm run build            # Build for production
npm run preview          # Preview production build
npm run test             # Run frontend tests
```

### Environment Variables

#### Backend (.env)
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/socio_db"

# Server
PORT=5001
NODE_ENV=development

# Authentication
JWT_SECRET="your-super-secret-jwt-key"

# Email (for notifications)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="noreply@socio.com"

# Frontend URL (for CORS)
FRONTEND_URL="http://localhost:5173"

# Timezone
TZ="UTC"
```

#### Frontend (.env)
```env
VITE_API_URL="http://localhost:5001/api"
```

## 🧪 Testing

### Run Tests
```bash
# All tests
npm run test

# Backend tests only
npm run test:backend

# Frontend tests only
npm run test:frontend

# Tests with coverage
npm run test:coverage
```

### Test Structure
- **Backend**: Unit tests for scheduling algorithm and API endpoints
- **Frontend**: Component tests for forms and user interactions

## 📊 Database Schema

The application uses the following main entities:

- **Staff**: Staff members with qualifications and availability
- **Rules**: Scheduling rules with requirements and preferences
- **Shifts**: Assigned shifts for staff members
- **Availability**: Staff availability submissions
- **SchedulingException**: Exceptions and conflicts

## 🔐 Authentication

The application uses JWT-based authentication. Default test credentials:
- **Email**: `admin@test.com`
- **Password**: `password123`

## 📧 Email Notifications

The system sends automated emails for:
- Availability reminders to temporary staff
- Schedule summaries to all staff
- Error notifications to administrators

## 🚀 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues:

1. Check the [Issues](../../issues) page for existing solutions
2. Create a new issue with detailed information
3. Include error logs and steps to reproduce

## 🔄 Updates

To update the project:

```bash
# Pull latest changes
git pull origin main

# Update dependencies
npm run install:all

# Run migrations if needed
cd backend && npm run db:migrate

# Restart development servers
npm run dev
```

---

**Happy Scheduling! 🎉**
4567890-