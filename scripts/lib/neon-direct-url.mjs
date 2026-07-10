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

/**
 * On Windows, Node/Prisma often try Neon AAAA (IPv6) first and hit P1001 even when
 * the project is "Active" in the console. Pin libpq to an A-record via hostaddr.
 */
export async function preferNeonIpv4(env = process.env) {
  const { lookup } = await import('node:dns/promises');
  for (const key of ['DATABASE_URL', 'DIRECT_DATABASE_URL']) {
    const url = env[key]?.trim();
    if (!url || !url.includes('neon.tech') || url.includes('hostaddr=')) continue;
    try {
      const parsed = new URL(url);
      const { address } = await lookup(parsed.hostname, { family: 4 });
      parsed.searchParams.set('hostaddr', address);
      if (!parsed.searchParams.has('connect_timeout')) {
        parsed.searchParams.set('connect_timeout', '60');
      }
      env[key] = parsed.toString();
      console.log(`[db] ${key}: using IPv4 hostaddr ${address}`);
    } catch (err) {
      console.warn(`[db] ${key}: IPv4 lookup failed:`, err instanceof Error ? err.message : err);
    }
  }
}
