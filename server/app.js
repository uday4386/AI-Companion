import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { ROOT_DIR } from './db.js';
import { attachUser } from './auth.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import errorRoutes from './routes/errors.js';
import applicationRoutes from './routes/applications.js';
import notificationRoutes from './routes/notifications.js';
import reportRoutes from './routes/reports.js';
import auditRoutes from './routes/audit.js';

/* --------------------------- rate limiting --------------------------- */
/** Small in-memory limiter for sensitive endpoints (no external dependency). */
function rateLimit({ windowMs = 15 * 60 * 1000, max = 10, key = (req) => req.ip } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const k = key(req);
    const entry = hits.get(k);
    if (!entry || entry.resetAt < now) {
      hits.set(k, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      const retry = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retry));
      return res.status(429).json({
        error: `Too many attempts. Please try again in ${Math.ceil(retry / 60)} minute(s).`,
        code: 'RATE_LIMITED',
      });
    }
    return next();
  };
}

export async function createApp({ vite = null } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    next();
  });

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());
  app.use(attachUser);

  app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  if (process.env.NODE_ENV !== 'test') {
    app.use('/api/auth/login', rateLimit({ max: 20, windowMs: 10 * 60 * 1000 }));
    app.use('/api/auth/access-request', rateLimit({ max: 8, windowMs: 30 * 60 * 1000 }));
    app.use('/api/auth/forgot-password', rateLimit({ max: 8, windowMs: 30 * 60 * 1000 }));
  }

  app.use('/api/auth', authRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/errors', errorRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api', userRoutes);
  app.use('/api', applicationRoutes);
  app.use('/api', auditRoutes);

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found.', code: 'NOT_FOUND' }));

  if (vite) {
    app.use(vite.middlewares);
  } else {
    const dist = path.join(ROOT_DIR, 'dist');
    if (fs.existsSync(dist)) {
      app.use(express.static(dist, { index: false, maxAge: '1h' }));
      app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
    } else {
      app.get('*', (_req, res) =>
        res.status(503).type('text/plain').send('The client bundle has not been built yet. Run `npm run build` and restart.'),
      );
    }
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request payload is too large.', code: 'PAYLOAD_TOO_LARGE' });
    }
    console.error('[server] unhandled error:', err);
    if (res.headersSent) return;
    res.status(500).json({ error: 'Something went wrong on the server. Please retry.', code: 'SERVER_ERROR' });
  });

  return app;
}
