/** Derive Neon direct (non-pooler) URL for Prisma migrations. */
export function neonDirectUrl(url) {
  if (!url || typeof url !== 'string') return url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('-pooler')) {
      parsed.hostname = parsed.hostname.replace('-pooler', '');
    }
    parsed.searchParams.delete('pgbouncer');
    return parsed.toString();
  } catch {
    return url.replace('-pooler', '').replace(/([?&])pgbouncer=true&?/g, '$1').replace(/\?&/, '?').replace(/[?&]$/, '');
  }
}

export function ensureDirectDatabaseUrl(env = process.env) {
  if (env.DIRECT_DATABASE_URL?.trim()) return env.DIRECT_DATABASE_URL;
  if (!env.DATABASE_URL?.trim()) return undefined;
  const direct = neonDirectUrl(env.DATABASE_URL);
  env.DIRECT_DATABASE_URL = direct;
  return direct;
}
