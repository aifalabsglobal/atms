const required = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL'] as const;

export function validateEnv() {
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (
    process.env.NODE_ENV === 'production' &&
    process.env.NEXTAUTH_SECRET === 'jntuh-scms-dev-secret-change-in-production'
  ) {
    console.warn('[env] NEXTAUTH_SECRET is still the dev default — change it before production deploy.');
  }
}

let validated = false;

export function ensureEnv() {
  if (validated || process.env.NEXT_PHASE === 'phase-production-build') return;
  validateEnv();
  validated = true;
}
