import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

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

export function errorHandler(
  err: unknown,
  _req: Request,
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
    details = err.flatten();
  } else if (err instanceof SyntaxError) {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Malformed JSON in request body';
  }

  if (statusCode >= 500) {
    console.error('[error]', err);
  }

  const body: Record<string, unknown> = {
    error: { code, message },
  };

  if (details !== undefined) {
    body.error = { ...(body.error as object), details };
  }

  res.status(statusCode).json(body);
}
