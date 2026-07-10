import { PrismaClient } from '@prisma/client';
import { ensureEnv } from '@/lib/env';
import { setDefaultResultOrder } from 'node:dns';
import { execFileSync } from 'node:child_process';

// Windows + Neon: prefer IPv4 so Prisma does not hang on unreachable AAAA routes (P1001).
try {
  setDefaultResultOrder('ipv4first');
} catch {
  /* ignore */
}

const CONNECTION_ERROR_CODES = new Set(['P1001', 'P1017', 'P2024']);

function resolveIpv4(hostname: string): string | null {
  try {
    const script = `require('dns').promises.lookup(${JSON.stringify(hostname)},{family:4}).then(r=>process.stdout.write(r.address)).catch(()=>process.exit(1))`;
    const address = execFileSync(process.execPath, ['-e', script], {
      encoding: 'utf8',
      timeout: 15_000,
      windowsHide: true,
    }).trim();
    return address || null;
  } catch {
    return null;
  }
}

/** Pin Neon URLs to an A-record so Prisma's engine does not prefer broken IPv6 on Windows. */
function pinNeonIpv4Hostaddr(url: string): string {
  if (!url.includes('neon.tech') || url.includes('hostaddr=')) return url;
  try {
    const parsed = new URL(url);
    const address = resolveIpv4(parsed.hostname);
    if (!address) return url;
    parsed.searchParams.set('hostaddr', address);
    if (!parsed.searchParams.has('connect_timeout')) {
      parsed.searchParams.set('connect_timeout', '60');
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function pinNeonUrlsForWindows(): void {
  if (process.env.VERCEL || process.platform !== 'win32') return;
  if (process.env.DATABASE_URL) {
    process.env.DATABASE_URL = pinNeonIpv4Hostaddr(process.env.DATABASE_URL);
  }
  if (process.env.DIRECT_DATABASE_URL) {
    process.env.DIRECT_DATABASE_URL = pinNeonIpv4Hostaddr(process.env.DIRECT_DATABASE_URL);
  }
}

function isConnectionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: string }).code;
  if (code && CONNECTION_ERROR_CODES.has(code)) return true;
  const message = String((error as { message?: string }).message ?? '');
  if (/Transaction already closed|expired transaction|Transaction API error/i.test(message)) {
    return false;
  }
  return /connection pool|ECONNREFUSED|Can't reach database server|connect timeout|Timed out fetching/i.test(
    message,
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createPrismaClient() {
  ensureEnv();
  pinNeonUrlsForWindows();
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    transactionOptions: {
      maxWait: 15_000,
      timeout: 60_000,
    },
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
