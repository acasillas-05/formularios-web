import { PrismaClient } from '@prisma/client';

import { config } from './config.js';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log: config.isProduction ? ['error'] : ['warn', 'error'],
  });

if (!config.isProduction) {
  globalThis.__prisma = prisma;
}
