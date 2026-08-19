import type { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';

import { config } from '../config/env.js';

export function requestLogger(): ReturnType<typeof morgan> {
  return morgan(config.isDevelopment ? 'dev' : 'combined');
}

export function requestContext(): (
  req: Request,
  res: Response,
  next: NextFunction,
) => void {
  return (req, _res, next) => {
    req.headers['x-request-id'] =
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    next();
  };
}
