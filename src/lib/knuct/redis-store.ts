/**
 * Upstash Redis REST key-value store for Knuct sessions (multi-instance safe).
 * Falls back to in-memory Map when Upstash is not configured (local dev).
 */
import { isUpstashConfigured } from '@/lib/env';

type MemoryEntry = { value: string; expiresAt: number };

const memory = new Map<string, MemoryEntry>();

function purgeMemory(): void {
  const now = Date.now();
  for (const [key, entry] of memory.entries()) {
    if (now > entry.expiresAt) memory.delete(key);
  }
}

async function upstashPipeline(commands: unknown[]): Promise<unknown[]> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Upstash not configured');

  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Upstash pipeline failed: HTTP ${res.status}`);
  const data = (await res.json()) as { result: unknown }[];
  return data.map((d) => d.result);
}

export async function knuctKvGet(key: string): Promise<string | null> {
  purgeMemory();
  if (isUpstashConfigured()) {
    try {
      const url = process.env.UPSTASH_REDIS_REST_URL!;
      const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
      const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { result: string | null };
      return data.result ?? null;
    } catch (err) {
      console.warn('[knuct-kv] Upstash get failed, using memory:', err);
    }
  }
  const entry = memory.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    memory.delete(key);
    return null;
  }
  return entry.value;
}

export async function knuctKvSet(key: string, value: string, ttlSec: number): Promise<void> {
  purgeMemory();
  if (isUpstashConfigured()) {
    try {
      await upstashPipeline([
        ['SET', key, value],
        ['EXPIRE', key, Math.max(1, ttlSec)],
      ]);
      return;
    } catch (err) {
      console.warn('[knuct-kv] Upstash set failed, using memory:', err);
    }
  }
  memory.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
}

export async function knuctKvDel(key: string): Promise<void> {
  if (isUpstashConfigured()) {
    try {
      const url = process.env.UPSTASH_REDIS_REST_URL!;
      const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
      await fetch(`${url}/del/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
    } catch {
      /* ignore */
    }
  }
  memory.delete(key);
}

export function knuctKvBackend(): 'upstash' | 'memory' {
  return isUpstashConfigured() ? 'upstash' : 'memory';
}

export type KnuctKvPingResult = {
  backend: 'upstash' | 'memory';
  status: 'ok' | 'error';
  latencyMs: number;
  error?: string;
};

/** Real Upstash SET/GET roundtrip (no in-memory fallback). Memory backend returns ok immediately. */
export async function knuctKvPing(): Promise<KnuctKvPingResult> {
  if (!isUpstashConfigured()) {
    return { backend: 'memory', status: 'ok', latencyMs: 0 };
  }

  const started = Date.now();
  const key = `knuct:health:${Date.now()}`;
  const value = 'pong';

  try {
    await upstashPipeline([
      ['SET', key, value],
      ['EXPIRE', key, 10],
    ]);

    const url = process.env.UPSTASH_REDIS_REST_URL!;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
    const getRes = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!getRes.ok) {
      throw new Error(`GET failed: HTTP ${getRes.status}`);
    }
    const getData = (await getRes.json()) as { result: string | null };
    if (getData.result !== value) {
      throw new Error('roundtrip value mismatch');
    }

    await fetch(`${url}/del/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    return { backend: 'upstash', status: 'ok', latencyMs: Date.now() - started };
  } catch (err) {
    return {
      backend: 'upstash',
      status: 'error',
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : 'Redis ping failed',
    };
  }
}
