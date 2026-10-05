const path = require('path');

// Same CWD-independent load as db.js — see the note there.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const { connect, MONGODB_URI, mongoose } = require('./db');

const { requireAuth } = require('./lib/auth');
const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/uploads');
const appRoutes = require('./routes/app');
const customerRoutes = require('./routes/customers');
const cashboxRoutes = require('./routes/cashbox');

const PORT = Number(process.env.PORT || 4000);
const startedAt = Date.now();

const app = express();

app.use(cors());

// Base64 image payloads make bodies large; keep the cap just above the
// upload limit so an oversize image fails with a clear 413, not a parse error.
app.use(express.json({ limit: '12mb' }));

// Tiny request log — invaluable when driving the app from adb.
app.use((req, res, next) => {
  const t0 = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - t0}ms)`);
  });
  next();
});

/**
 * java.net.HttpURLConnection — which is what the Android client uses — refuses
 * to send PATCH, so the app posts with `X-HTTP-Method-Override: PATCH`. Rewrite
 * the verb here, before routing, so the routes can keep their real semantics.
 * (`req.method` is writable; Express matches on it when it dispatches.)
 */
app.use((req, res, next) => {
  if (req.method === 'POST') {
    const override = String(req.get('X-HTTP-Method-Override') || '').toUpperCase();
    if (override === 'PATCH' || override === 'PUT' || override === 'DELETE') {
      req.method = override;
    }
  }
  next();
});

app.get('/api/health', (req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    ok: mongoose.connection.readyState === 1,
    db: states[mongoose.connection.readyState] || 'unknown',
    database: mongoose.connection.name || null,
    host: mongoose.connection.host || null,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
  });
});

// Public: register / login. The router guards its own /me and /logout.
app.use('/api/auth', authRoutes);

// Everything below requires a valid bearer token, and every handler scopes its
// queries to req.user._id — that is what keeps each account's book separate.
app.use('/api/uploads', uploadRoutes);
app.use('/api', requireAuth, appRoutes);
app.use('/api/customers', requireAuth, customerRoutes);
app.use('/api/cashbox', requireAuth, cashboxRoutes);

// Live data preview — same origin as the API, so no CORS gymnastics.
// Open http://127.0.0.1:4000/ to see exactly what the Android app receives.
app.use('/', express.static(path.join(__dirname, '..', 'public')));

app.use((req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}` });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({
    error: status === 401 ? 'UNAUTHORIZED' : status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
    message: err.message || 'কিছু একটা ভুল হয়েছে',
    details: err.details,
  });
});

(async () => {
  try {
    const conn = await connect();
    const safe = MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
    console.log(`[db] connected to ${conn.name} @ ${conn.host}  (${safe})`);

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[api] listening on http://0.0.0.0:${PORT}`);
      console.log('[api] device access: adb reverse tcp:%d tcp:%d  ->  http://127.0.0.1:%d/', PORT, PORT, PORT);
      const cloud = process.env.CLOUDINARY_CLOUD_NAME;
      console.log(`[api] image uploads: ${cloud ? `Cloudinary (${cloud})` : 'NOT configured'}`);
    });
  } catch (err) {
    console.error('[db] connection failed:', err.message);
    process.exit(1);
  }
})();

const shutdown = async (signal) => {
  console.log(`\n[api] ${signal} received, shutting down`);
  await mongoose.connection.close().catch(() => {});
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
