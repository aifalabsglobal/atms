import { z } from 'zod';

const DEV_SECRET = 'aimscs-dev-secret-change-in-production';

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .refine((v) => v.startsWith('postgresql://') || v.startsWith('postgres://'), {
      message: 'DATABASE_URL must be a PostgreSQL connection string',
    }),
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),
  NEXTAUTH_URL: z.string().url('NEXTAUTH_URL must be a valid URL'),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  ALLOW_IN_MEMORY_RATE_LIMIT: z.enum(['true', 'false']).optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Neon pooler URLs cannot run Prisma migrations — strip -pooler for directUrl. */
function neonDirectDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('-pooler')) {
      parsed.hostname = parsed.hostname.replace('-pooler', '');
    }
    parsed.searchParams.delete('pgbouncer');
    return parsed.toString();
  } catch {
    return url.replace('-pooler', '');
  }
}

/** Vercel sets VERCEL_URL per deployment; NextAuth needs NEXTAUTH_URL for cookies/sessions. */
export function applyPlatformDefaults(): void {
  if (process.env.VERCEL) {
    process.env.AUTH_TRUST_HOST = 'true';
  }
  if (process.env.DATABASE_URL && !process.env.DIRECT_DATABASE_URL) {
    process.env.DIRECT_DATABASE_URL = neonDirectDatabaseUrl(process.env.DATABASE_URL);
  }
  // Always match the active deployment host (production + preview URLs differ).
  if (process.env.VERCEL_URL) {
    process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
    return;
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL && !process.env.NEXTAUTH_URL) {
    process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
}

export function validateEnv(): Env {
  applyPlatformDefaults();
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${details}`);
  }

  const env = parsed.data;
  const isProd = env.NODE_ENV === 'production';
  const isVercel = Boolean(process.env.VERCEL);
  const isLocalHost =
    env.NEXTAUTH_URL.startsWith('http://localhost') ||
    env.NEXTAUTH_URL.startsWith('http://127.0.0.1');

  if (isProd && env.NEXTAUTH_SECRET === DEV_SECRET && !isLocalHost && !isVercel) {
    throw new Error('NEXTAUTH_SECRET is still the dev default — set a strong secret before production deploy.');
  }
  if (isProd && env.NEXTAUTH_SECRET === DEV_SECRET && !isLocalHost && isVercel) {
    console.warn(
      '[env] NEXTAUTH_SECRET is still the dev default on Vercel — set a strong secret in project env vars.'
    );
  }

  const hasUpstash = !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
  const allowMemory = env.ALLOW_IN_MEMORY_RATE_LIMIT === 'true' || (isVercel && !hasUpstash);

  if (isProd && !hasUpstash && !allowMemory && !isLocalHost && !isVercel) {
    throw new Error(
      'Production requires Upstash Redis (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN) ' +
        'or set ALLOW_IN_MEMORY_RATE_LIMIT=true for single-instance deploys.'
    );
  }

  if (
    (env.UPSTASH_REDIS_REST_URL && !env.UPSTASH_REDIS_REST_TOKEN) ||
    (!env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN)
  ) {
    const msg =
      'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must both be set or both omitted.';
    if (isVercel) {
      console.warn(`[env] ${msg} Ignoring partial Upstash config on Vercel.`);
    } else {
      throw new Error(msg);
    }
  }

  return env;
}

export function ensureEnv(): Env {
  if (cached) return cached;
  applyPlatformDefaults();
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return envSchema.parse({
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://build:build@localhost:5432/build',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? 'ci-build-secret-min-32-chars-long',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
    });
  }
  cached = validateEnv();
  return cached;
}

function hasUpstashEnvVars(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export function isUpstashConfigured(): boolean {
  if (!hasUpstashEnvVars()) return false;
  try {
    const env = ensureEnv();
    return !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
  } catch {
    return hasUpstashEnvVars();
  }
}

export function allowsInMemoryRateLimit(): boolean {
  if (process.env.NEXT_PHASE === 'phase-production-build') return true;
  if (process.env.VERCEL && !hasUpstashEnvVars()) return true;
  const env = ensureEnv();
  return env.NODE_ENV !== 'production' || env.ALLOW_IN_MEMORY_RATE_LIMIT === 'true' || isUpstashConfigured();
}
