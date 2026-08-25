import { Request, Response } from 'express';

import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

export const getHealth = asyncHandler(async (_req: Request, res: Response) => {
  let database = 'down';
  let dbLatencyMs: number | null = null;
  try {
    const start = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Math.round(performance.now() - start);
    database = 'up';
  } catch {
    // Database reachability is reported in the response body; the API itself
    // stays up so monitoring can see the degraded state.
  }

  const statusCode = database === 'up' ? 200 : 503;
  res.status(statusCode).json({
    status: database === 'up' ? 'ok' : 'degraded',
    service: 'autoparts-api',
    database,
    dbLatencyMs,
    uptime: formatUptime(process.uptime()),
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV ?? 'unknown',
  });
});
