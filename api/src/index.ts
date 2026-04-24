import { createApp } from './app.js';
import { config } from './config.js';
import { closePool } from './mssql.js';
import { prisma } from './prisma.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`[api] listening on http://localhost:${config.port} (${config.nodeEnv})`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`[api] received ${signal}, shutting down`);
  setTimeout(() => process.exit(1), 5_000).unref();
  server.close();
  await Promise.allSettled([closePool(), prisma.$disconnect()]);
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
