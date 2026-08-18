import { createServer } from 'node:http';

import app from './app.js';
import { config } from './config/env.js';
import { verifyConnection } from './services/email.service.js';
import prisma from './lib/prisma.js';

process.on('unhandledRejection', (reason: unknown) => {
  console.error('[process] unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[process] uncaughtException:', err);
  process.exit(1);
});

const server = createServer(app);

server.listen(config.port, async () => {
  console.log(
    `[autoparts-api] listening on http://localhost:${config.port} (${config.env})`,
  );

  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('[autoparts-api] database connection verified');
  } catch {
    console.warn('[autoparts-api] WARNING: database is unreachable on startup — login/data endpoints will fail until it is available');
  }

  await verifyConnection();
});

async function shutdown(signal: string): Promise<void> {
  console.log(`[autoparts-api] ${signal} received, shutting down...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[autoparts-api] forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
