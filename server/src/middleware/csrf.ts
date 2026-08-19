import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

import { config } from '../config/env.js';
import { ApiError } from './error.js';

export const AUTH_COOKIE_NAME = 'autoparts_token';
export const CSRF_COOKIE_NAME = 'autoparts_csrf';

export const AUTH_COOKIE_MAX_AGE = 8 * 60 * 60 * 1000; // matches JWT_EXPIRES_IN=8h

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Pre-auth endpoints that must remain reachable without a CSRF token.
const CSRF_EXEMPT_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/csrf',
]);

export function csrfCookieOptions() {
  return {
    httpOnly: false,
    secure: config.isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: AUTH_COOKIE_MAX_AGE,
  };
}

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Double-submit cookie CSRF protection. The client reads its CSRF token from
 * `GET /api/auth/csrf` (cookie is set on the API origin) and echoes it back in
 * the `X-CSRF-Token` header on state-changing requests. Attackers cannot read or
 * set the victim's `autoparts_csrf` cookie, so a forged cross-site request fails
 * the token match.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();
  if (CSRF_EXEMPT_PATHS.has(req.path)) return next();

  const cookieToken = (req.cookies as Record<string, string | undefined> | undefined)?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers['x-csrf-token'];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    next(new ApiError(403, 'CSRF_TOKEN_INVALID', 'CSRF token missing or invalid'));
    return;
  }
  next();
}