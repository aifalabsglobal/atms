import { z } from 'zod';

const DEV_SECRET = 'jntuh-scms-dev-secret-change-in-production';

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

export function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${details}`);
  }

  const env = parsed.data;
  const isProd = env.NODE_ENV === 'production';

  if (isProd && env.NEXTAUTH_SECRET === DEV_SECRET) {
    throw new Error('NEXTAUTH_SECRET is still the dev default — set a strong secret before production deploy.');
  }

  const hasUpstash = !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
  const allowMemory = env.ALLOW_IN_MEMORY_RATE_LIMIT === 'true';

  if (isProd && !hasUpstash && !allowMemory) {
    throw new Error(
      'Production requires Upstash Redis (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN) ' +
        'or set ALLOW_IN_MEMORY_RATE_LIMIT=true for single-instance deploys.'
    );
  }

  if (
    (env.UPSTASH_REDIS_REST_URL && !env.UPSTASH_REDIS_REST_TOKEN) ||
    (!env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN)
  ) {
    throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must both be set or both omitted.');
  }

  return env;
}

export function ensureEnv(): Env {
  if (cached) return cached;
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

export function isUpstashConfigured(): boolean {
  const env = ensureEnv();
  return !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

export function allowsInMemoryRateLimit(): boolean {
  if (process.env.NEXT_PHASE === 'phase-production-build') return true;
  const env = ensureEnv();
  return env.NODE_ENV !== 'production' || env.ALLOW_IN_MEMORY_RATE_LIMIT === 'true' || isUpstashConfigured();
}
