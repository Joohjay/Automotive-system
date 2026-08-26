import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

import { config } from '../config/env.js';

function ipKey(req: { ip?: string; socket?: { remoteAddress?: string } }) {
  return ipKeyGenerator(req.ip ?? req.socket?.remoteAddress ?? '127.0.0.1');
}

// ── Auth endpoints: strict (10/min) ──
export const loginLimiter = rateLimit({
  windowMs: 60_000,
  max: config.authLoginLimit,
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Please try again later.' } },
  keyGenerator: ipKey,
});

// ── Heavy write endpoints: moderate (60/min) ──
// POS sales, inventory adjustments, returns, loans, expenses
export const writeLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Write rate limit exceeded. Please slow down.' } },
  keyGenerator: ipKey,
});

// ── Read endpoints: generous (600/min = 10/sec) ──
export const readLimiter = rateLimit({
  windowMs: 60_000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many read requests. Please try again later.' } },
  keyGenerator: ipKey,
});

// ── Global API limiter: safety net (configurable, default 500/min) ──
export const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: config.authGlobalLimit,
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
  keyGenerator: ipKey,
});

// ── MFA verify endpoint: very strict (5/min) ──
export const mfaLimiter = rateLimit({
  windowMs: 60_000,
  max: config.mfaLimit,
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many MFA attempts. Please try again later.' } },
  keyGenerator: ipKey,
});
