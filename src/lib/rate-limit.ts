import { NextResponse } from 'next/server';
import { allowsInMemoryRateLimit, isUpstashConfigured } from '@/lib/env';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function memoryCheck(
  key: string,
  limit: number,
  windowMs: number
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (bucket.count >= limit) {
    return { ok: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { ok: true };
}

/** Upstash Redis REST sliding-window counter (multi-instance safe). */
async function upstashCheck(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (!allowsInMemoryRateLimit()) {
      console.error('[rate-limit] Upstash not configured in production');
      return { ok: false, retryAfterSec: 60 };
    }
    return memoryCheck(key, limit, windowMs);
  }

  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const redisKey = `rl:${key}`;

  try {
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', redisKey],
        ['TTL', redisKey],
      ]),
      cache: 'no-store',
    });

    if (!res.ok) {
      console.warn('[rate-limit] Upstash error, falling back to memory');
      if (!allowsInMemoryRateLimit()) {
        return { ok: false, retryAfterSec: 60 };
      }
      return memoryCheck(key, limit, windowMs);
    }

    const data = (await res.json()) as { result: unknown }[];
    const count = Number(data[0]?.result ?? 0);
    let ttl = Number(data[1]?.result ?? -1);

    if (ttl < 0) {
      await fetch(`${url}/expire/${encodeURIComponent(redisKey)}/${windowSec}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      ttl = windowSec;
    }

    if (count > limit) {
      return { ok: false, retryAfterSec: Math.max(1, ttl) };
    }
    return { ok: true };
  } catch (err) {
    console.warn('[rate-limit] Upstash unavailable:', err);
    if (!allowsInMemoryRateLimit()) {
      return { ok: false, retryAfterSec: 60 };
    }
    return memoryCheck(key, limit, windowMs);
  }
}

export function rateLimitResponse(retryAfterSec: number) {
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
  );
}

export async function enforceRateLimit(key: string, limit = 60, windowMs = 60_000) {
  const result = await upstashCheck(key, limit, windowMs);
  if (!result.ok) return rateLimitResponse(result.retryAfterSec);
  return null;
}

export function getRateLimitBackend(): 'upstash' | 'memory' {
  return isUpstashConfigured() ? 'upstash' : 'memory';
}
