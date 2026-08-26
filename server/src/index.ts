import cluster from 'node:cluster';
import { createServer } from 'node:http';
import os from 'node:os';

import app from './app.js';
import { config } from './config/env.js';
import { verifyConnection } from './services/email.service.js';
import prisma from './lib/prisma.js';

// ── Memory tuning for high concurrency ──
// Raise the V8 heap to 4 GB so large concurrent workloads don't GC-stall.
if (!process.env.NODE_OPTIONS?.includes('--max-old-space-size')) {
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ''} --max-old-space-size=4096`.trim();
}

process.on('unhandledRejection', (reason: unknown) => {
  console.error('[process] unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[process] uncaughtException:', err);
  process.exit(1);
});

// ── Cluster mode for 20k concurrent ──
// In production, fork one worker per CPU core. In dev/test, run single process.
const isCluster = config.isProduction && cluster.isPrimary;
const cpuCount = os.cpus().length;

if (isCluster) {
  console.log(`[autoparts-api] master PID ${process.pid} forking ${cpuCount} workers…`);

  for (let i = 0; i < cpuCount; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code) => {
    console.error(`[autoparts-api] worker ${worker.process.pid} exited (code ${code}), restarting…`);
    cluster.fork();
  });
} else {
  startServer();
}

function startServer() {
  const server = createServer(app);

  // Slowloris protection + high-concurrency tuning
  server.timeout = 30_000;           // 30s full request timeout
  server.headersTimeout = 31_000;    // 31s headers timeout
  server.keepAliveTimeout = 15_000;  // 15s keep-alive (reclaim connections faster)
  server.maxHeadersCount = 50;       // cap headers to prevent abuse

  // Raise the per-process file descriptor / connection ceiling
  // (Linux: ulimit -n must also be raised OS-side for real 20k)
  server.listen(config.port, async () => {
    const label = config.isProduction
      ? `[autoparts-api] worker ${process.pid}`
      : '[autoparts-api]';

    console.log(`${label} listening on http://localhost:${config.port} (${config.env})`);

    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log(`${label} database connection verified`);
    } catch {
      console.warn(`${label} WARNING: database is unreachable on startup`);
    }

    await verifyConnection();
  });

  async function shutdown(signal: string): Promise<void> {
    console.log(`[autoparts-api] ${signal} received, shutting down…`);
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
}
