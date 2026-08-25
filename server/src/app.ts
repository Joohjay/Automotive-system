import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

app.use(helmet({
  contentSecurityPolicy: config.isProduction ? undefined : false,
  crossOriginEmbedderPolicy: false,
}));
app.use(
  cors({
    origin: config.clientOrigin,
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(requestContext());
app.use(requestLogger());
app.use(csrfProtection);
app.use('/api', globalLimiter);

app.use('/api', apiRouter);

// Serve built frontend
app.use(express.static(clientDist));

// SPA fallback — any non-API GET that wasn't a static file returns index.html
app.get('/{*splat}', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
