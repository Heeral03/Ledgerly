require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');
const dashboardRoutes = require('./routes/dashboard');

// Ensure uploads dir exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();

// ── Security headers ────────────────────────────────────────────────
app.use(helmet());

// ── CORS: only allow the frontend origin ────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// ── Routes ──────────────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/admin',      adminRoutes);
app.use('/api/user',       userRoutes);
app.use('/api/dashboards', dashboardRoutes);

// ── Health check & Root ──────────────────────────────────────────────
app.get('/', (_req, res) => res.json({ status: 'ok', service: 'Ledgerly API Engine', health: '/api/health' }));
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ── Global error handler ─────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅  Backend running on http://localhost:${PORT}`));
