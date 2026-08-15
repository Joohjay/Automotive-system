import { createServer } from 'node:http';

import app from './app.js';
import { config } from './config/env.js';
import prisma from './lib/prisma.js';

const server = createServer(app);

server.listen(config.port, () => {
  console.log(
    `[autoparts-api] listening on http://localhost:${config.port} (${config.env})`,
  );
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
