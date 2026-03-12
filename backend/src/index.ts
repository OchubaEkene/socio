import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import * as dotenv from 'dotenv';
import prisma from './lib/prisma';

// Import routes
import authRoutes from './routes/auth';
import staffRoutes from './routes/staff';
import availabilityRoutes from './routes/availability';
import rulesRoutes from './routes/rules';
import schedulingRoutes from './routes/scheduling';
import scheduledTasksRoutes from './routes/scheduled-tasks';
import schedulingExceptionsRoutes from './routes/scheduling-exceptions';
import scheduleEditsRoutes from './routes/schedule-edits';
import reportsRoutes from './routes/reports';
import absencesRoutes from './routes/absences';
import vacationsRoutes from './routes/vacations';
import shiftSwapsRoutes from './routes/shift-swaps';
import workingTimeAccountsRoutes from './routes/working-time-accounts';
import spreadsheetExportRoutes from './routes/spreadsheet-export';
import timeRecordsRoutes from './routes/time-records';
import contractsRoutes from './routes/contracts';
import schedulePlansRoutes from './routes/schedule-plans';
import orgSettingsRoutes from './routes/org-settings';
import { initializeScheduledTasks } from './services/scheduledTasks';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(o => origin.startsWith(o))) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoints
const healthHandler = (_req: express.Request, res: express.Response) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/rules', rulesRoutes);
app.use('/api/scheduling', schedulingRoutes);
app.use('/api/scheduled-tasks', scheduledTasksRoutes);
app.use('/api/scheduling-exceptions', schedulingExceptionsRoutes);
app.use('/api/schedule-edits', scheduleEditsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/absences', absencesRoutes);
app.use('/api/vacations', vacationsRoutes);
app.use('/api/shift-swaps', shiftSwapsRoutes);
app.use('/api/working-time-accounts', workingTimeAccountsRoutes);
app.use('/api/spreadsheet-export', spreadsheetExportRoutes);
app.use('/api/time-records', timeRecordsRoutes);
app.use('/api/contracts', contractsRoutes);
app.use('/api/schedule-plans', schedulePlansRoutes);
app.use('/api/org-settings', orgSettingsRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Start server
async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      
      // Initialize scheduled tasks
      initializeScheduledTasks();
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

startServer();
