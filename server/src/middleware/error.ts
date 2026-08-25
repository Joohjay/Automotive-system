import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';

import { config } from '../config/env.js';

// Tracks request start time for response-time logging
declare global {
  namespace Express {
    interface Request {
      startTime?: number;
    }
  }
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'Unauthorized'): ApiError {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Forbidden'): ApiError {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Resource not found'): ApiError {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static conflict(message: string, details?: unknown): ApiError {
    return new ApiError(409, 'CONFLICT', message, details);
  }
}

export function notFoundHandler(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next(ApiError.notFound('Requested endpoint does not exist'));
}

function isPrismaError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const name = err.constructor?.name ?? '';
  return name.includes('Prisma');
}

function prismaErrorCode(err: unknown): string | null {
  if (!isPrismaError(err)) return null;
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

// Maps Prisma error codes to stable HTTP responses so clients get accurate
// status codes instead of a blanket 503. Internal details are never leaked.
function prismaErrorResponse(
  err: unknown,
  fallback: { statusCode: number; code: string; message: string },
): { statusCode: number; code: string; message: string } {
  const code = prismaErrorCode(err);
  switch (code) {
    case 'P2000':
      return { statusCode: 400, code: 'INVALID_VALUE', message: 'A provided value is too long for its field' };
    case 'P2002':
      return { statusCode: 409, code: 'CONFLICT', message: 'This record already exists' };
    case 'P2003':
      return { statusCode: 409, code: 'CONFLICT', message: 'This record is referenced by other data' };
    case 'P2025':
      return { statusCode: 404, code: 'NOT_FOUND', message: 'The requested record was not found' };
    case 'P2014':
      return { statusCode: 409, code: 'CONFLICT', message: 'This change would break related data' };
    case 'P2024':
      return fallback; // connection pool timeout -> treat as temporarily unavailable
    default:
      return fallback;
  }
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details: unknown;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    code = 'INVALID_REQUEST';
    message = 'Invalid request data';
    // In production, don't leak internal field names and validation rules
    if (config.isProduction) {
      details = undefined;
    } else {
      details = err.flatten();
    }
  } else if (err instanceof SyntaxError) {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Malformed JSON in request body';
  } else if (err instanceof jwt.TokenExpiredError) {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Authentication token has expired. Please log in again.';
  } else if (err instanceof jwt.JsonWebTokenError) {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    code = 'INVALID_REQUEST';
    message = 'Invalid request data';
    console.error('[error] prisma validation:', (err as Error).message);
  } else if (isPrismaError(err)) {
    const mapped = prismaErrorResponse(err, {
      statusCode: 503,
      code: 'DATABASE_UNAVAILABLE',
      message: 'The database is temporarily unavailable. Please try again in a moment.',
    });
    statusCode = mapped.statusCode;
    code = mapped.code;
    message = mapped.message;
    console.error('[error] database error:', (err as Error).message);
  }

  if (statusCode >= 500 && !isPrismaError(err)) {
    console.error('[error]', err);
    details = undefined; // Never leak internal details in 5xx responses
  }

  const body: Record<string, unknown> = {
    error: { code, message },
  };

  if (details !== undefined) {
    body.error = { ...(body.error as object), details };
  }

  // Attach request metadata for debugging
  const requestId = req.headers['x-request-id'];
  if (requestId) {
    body.requestId = requestId;
  }
  if (req.startTime) {
    body.durationMs = Math.round(performance.now() - req.startTime);
  }

  if (statusCode >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl} → ${statusCode} ${code}: ${message}`, {
      requestId,
      userId: (req as { user?: { id?: string } }).user?.id,
    });
  }

  res.status(statusCode).json(body);
}
