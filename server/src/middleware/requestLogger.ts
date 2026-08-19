import type { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';

import { config } from '../config/env.js';

export function requestLogger(): ReturnType<typeof morgan> {
  if (config.isDevelopment) return morgan('dev');
  return morgan(
    ':remote-addr :req[x-request-id] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms',
  );
}

export function requestContext(): (
  req: Request,
  res: Response,
  next: NextFunction,
) => void {
  return (req, res, next) => {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    req.headers['x-request-id'] = id;
    res.setHeader('X-Request-Id', id);
    next();
  };
}
