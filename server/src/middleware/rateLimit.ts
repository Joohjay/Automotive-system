import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

import { config } from '../config/env.js';

export const loginLimiter = rateLimit({
  windowMs: 60_000,
  max: config.authLoginLimit,
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Please try again later.' } },
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? '127.0.0.1'),
});

export const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: config.authGlobalLimit,
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? '127.0.0.1'),
});
