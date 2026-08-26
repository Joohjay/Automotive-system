import path from 'node:path';
import { fileURLToPath } from 'node:url';

import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { config } from './config/env.js';
import { csrfProtection } from './middleware/csrf.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { requestContext, requestLogger } from './middleware/requestLogger.js';
import { globalLimiter } from './middleware/rateLimit.js';
import apiRouter from './routes/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../client/dist');

const app = express();

if (config.isProduction) {
  app.set('trust proxy', 1);
}

// ── Compression ── responses under 1 KB are not compressed ──
app.use(compression({ threshold: 1024, level: 6 }));

// ── Security headers ──
app.use(helmet({
  contentSecurityPolicy: config.isProduction ? undefined : false,
  crossOriginEmbedderPolicy: false,
  // Prevent browsers from exposing server version
  hidePoweredBy: true,
}));

// Anti-inspection headers in production
if (config.isProduction) {
  app.use((_req, res, next) => {
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Prevent iframe embedding
    res.setHeader('X-Frame-Options', 'DENY');
    // Disable referrer leakage
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Disable browser features
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    // Prevent search engines from caching API responses
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    next();
  });
}

app.use(
  cors({
    origin: config.clientOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-CSRF-Token'],
    maxAge: 600,
  }),
);

// Body size limits: 256 KB (sufficient for POS payloads, prevents abuse)
app.use(express.json({ limit: '256kb' }));

app.use(cookieParser());
app.use(requestContext());
app.use(requestLogger());
app.use(csrfProtection);

// API-specific: disable caching to prevent stale data from shared proxies
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  next();
});

app.use('/api', globalLimiter);
app.use('/api', apiRouter);

// Serve built frontend with long-term caching for hashed assets
app.use(express.static(clientDist, {
  maxAge: config.isProduction ? '1y' : 0,
  immutable: config.isProduction,
  etag: true,
  lastModified: true,
}));

// SPA fallback — any non-API GET that wasn't a static file returns index.html
app.get('/{*splat}', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
