import { PrismaClient } from '@prisma/client';
import { config } from '../config/env.js';

// Connection pool sized for 20k concurrent: each server process gets up to 20 connections.
// With cluster mode (8 cores), total DB connections = 160 — well within PostgreSQL defaults.
const prisma = new PrismaClient({
  log: config.isProduction
    ? [{ level: 'warn', emit: 'event' }, { level: 'error', emit: 'event' }]
    : [],
  datasources: {
    db: {
      url: config.isProduction
        ? `${config.dbUrl}&connection_limit=20&pool_timeout=15`
        : `${config.dbUrl}&connection_limit=5&pool_timeout=10`,
    },
  },
});

if (config.isProduction) {
  prisma.$on('warn', (e) => {
    console.warn('[prisma] warn:', e.message);
  });
  prisma.$on('error', (e) => {
    console.error('[prisma] error:', e.message);
  });
}

export default prisma;
