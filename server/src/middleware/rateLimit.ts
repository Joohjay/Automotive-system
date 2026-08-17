import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Please try again later.' } },
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? '127.0.0.1'),
});

export const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? '127.0.0.1'),
});
