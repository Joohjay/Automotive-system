import { PrismaClient } from '@prisma/client';
import { config } from '../config/env.js';

const prisma = new PrismaClient({
  log: config.isProduction
    ? [{ level: 'warn', emit: 'event' }, { level: 'error', emit: 'event' }]
    : [],
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
