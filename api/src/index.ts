import { createApp } from './app.js';
import { assertProductionConfig, config } from './config.js';
import { closePool } from './mssql.js';
import { prisma } from './prisma.js';
import { startNotificationWorker } from './services/notifyService.js';

assertProductionConfig();

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`[api] listening on http://localhost:${config.port} (${config.nodeEnv})`);
});

const worker = startNotificationWorker();

async function shutdown(signal: string): Promise<void> {
  console.log(`[api] received ${signal}, shutting down`);
  setTimeout(() => process.exit(1), 5_000).unref();
  worker.stop();
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
