// backend/server.js - EMERGENCY CORS FIX
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const paymentRoutes = require('./routes/payment.routes');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// EMERGENCY CORS FIX - ALLOW ALL ORIGINS
// ============================================
app.use(cors({
  origin: '*', // Allow all origins temporarily
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
  optionsSuccessStatus: 200
}));

// Handle preflight
app.options('*', cors());

// Body Parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Request Logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.method === 'OPTIONS') {
    console.log('  ↳ Preflight from:', req.headers.origin);
  }
  next();
});

// ============================================
// ROUTES
// ============================================

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'GroupBuy Backend API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'GroupBuy Payment API',
    version: '1.0.0',
    endpoints: {
      payment: '/api/payment',
      health: '/health'
    }
  });
});

app.use('/api/payment', paymentRoutes);

// ============================================
// ERROR HANDLING
// ============================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});

app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log('');
  console.log('===========================================');
  console.log('🚀 GroupBuy Backend Server Started');
  console.log('===========================================');
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔓 CORS: ALLOW ALL (Emergency mode)`);
  console.log(`💳 Razorpay: ${process.env.RAZORPAY_KEY_ID?.includes('test') ? 'TEST' : 'LIVE'}`);
  console.log('===========================================');
  console.log('');
});

process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
});