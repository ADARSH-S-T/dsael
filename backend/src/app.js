import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import patientRoutes from './routes/patients.js';
import queueRoutes from './routes/queue.js';
import staffRoutes from './routes/staff.js';
import adminRoutes from './routes/admin.js';

const app = express();

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Request logger for development
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[LabFlow API] ${req.method} ${req.originalUrl}`);
  }
  next();
});

// Root & Healthcheck
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: 'LabFlow - Smart Laboratory Test Management System',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/admin', adminRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[API Internal Error]:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error occurred.'
  });
});

export default app;
