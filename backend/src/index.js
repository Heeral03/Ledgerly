require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

const requestLogger = require('./middleware/logger');
const { apiLimiter, authLimiter, uploadLimiter } = require('./middleware/rateLimiter');
const cache = require('./utils/cache');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');
const dashboardRoutes = require('./routes/dashboard');
const workspaceRoutes = require('./routes/workspaces');
const importRoutes = require('./routes/imports');

// ── Startup Secret & Environment Validation ─────────────────────────
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'super-secret-jwt-key-change-this-in-production') {
    console.error('CRITICAL SECURITY ERROR: Weak or default JWT_SECRET in production mode');
    process.exit(1);
  }
  if (!process.env.ENCRYPTION_KEY) {
    console.error('CRITICAL SECURITY ERROR: Missing ENCRYPTION_KEY in production mode');
    process.exit(1);
  }
}

// Ensure uploads dir exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();

// ── Performance Tracing & Logging ────────────────────────────────────
app.use(requestLogger);

// ── Security headers ────────────────────────────────────────────────
app.use(helmet());

// ── CORS: only allow the frontend origin ────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// ── Global & Specific Rate Limiting ──────────────────────────────────
app.use('/api/', apiLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/user/upload', uploadLimiter);
app.use('/api/user/sync-google-sheet', uploadLimiter);

// ── Routes ──────────────────────────────────────────────────────────
app.use('/api/auth',                        authRoutes);
app.use('/api/admin',                       adminRoutes);
app.use('/api/user',                        userRoutes);
app.use('/api/dashboards',                  dashboardRoutes);
app.use('/api/workspaces',                  workspaceRoutes);
app.use('/api/workspaces/:workspaceId/imports', importRoutes);

// ── Health Check & System Metrics Telemetry ──────────────────────────
app.get('/', (_req, res) => res.json({ status: 'ok', service: 'Ledgerly API Engine', health: '/api/health' }));
app.get('/api/health', (_req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));
app.get('/api/metrics', (_req, res) => {
  const memory = process.memoryUsage();
  res.json({
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    memoryUsage: {
      rssMb: (memory.rss / (1024 * 1024)).toFixed(2),
      heapTotalMb: (memory.heapTotal / (1024 * 1024)).toFixed(2),
      heapUsedMb: (memory.heapUsed / (1024 * 1024)).toFixed(2),
    },
    cacheStats: cache.stats(),
  });
});

// ── Global error handler ─────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅  Backend running on http://localhost:${PORT}`));

