import { PrismaClient } from '@prisma/client';
import { ensureEnv } from '@/lib/env';

const CONNECTION_ERROR_CODES = new Set(['P1001', 'P1017', 'P2024']);

function isConnectionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: string }).code;
  if (code && CONNECTION_ERROR_CODES.has(code)) return true;
  const message = String((error as { message?: string }).message ?? '');
  return /connection pool|ECONNREFUSED|Can't reach database server|connect timeout|Timed out fetching/i.test(
    message,
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createPrismaClient() {
  ensureEnv();
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const maxAttempts = 5;
          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
              return await query(args);
            } catch (error) {
              if (!isConnectionError(error) || attempt === maxAttempts - 1) {
                throw error;
              }
              await delay(500 * (attempt + 1));
            }
          }
        },
      },
    },
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

export { isConnectionError };
