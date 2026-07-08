import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getKnuctHealth, getKnuctQueueStats } from '@/lib/knuct';
import { getKnuctCircuitState } from '@/lib/knuct/circuit-breaker';
import { knuctKvPing } from '@/lib/knuct/redis-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET() {
  const started = Date.now();
  const checks: Record<string, 'ok' | 'error' | 'degraded'> = {};

  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch (err) {
    console.error('[health] database check failed:', err);
    checks.database = 'error';
  }

  let redisMeta: Awaited<ReturnType<typeof knuctKvPing>> | undefined;
  try {
    redisMeta = await Promise.race([
      knuctKvPing(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Redis ping timed out')), 5000)
      ),
    ]);
    checks.redis = redisMeta.status === 'ok' ? 'ok' : 'error';
  } catch (err) {
    console.error('[health] redis check failed:', err);
    checks.redis = 'error';
    redisMeta = {
      backend: 'upstash',
      status: 'error',
      latencyMs: 0,
      error: err instanceof Error ? err.message : 'Redis ping failed',
    };
  }

  try {
    const knuct = await Promise.race([
      getKnuctHealth({ ping: true }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Knuct health ping timed out')), 5000)
      ),
    ]);
    const queue = getKnuctQueueStats();
    const circuit = getKnuctCircuitState();
    checks.knuct =
      knuct.health === 'ok'
        ? 'ok'
        : knuct.health === 'degraded' || knuct.health === 'unknown'
          ? 'degraded'
          : 'error';
    checks.knuctQueue = queue.pending > 10 ? 'degraded' : 'ok';
  } catch (err) {
    console.error('[health] knuct check failed:', err);
    checks.knuct = 'degraded';
  }

  const knuctMeta = (() => {
    try {
      return {
        queue: getKnuctQueueStats(),
        circuit: getKnuctCircuitState(),
      };
    } catch {
      return undefined;
    }
  })();

  const latencyMs = Date.now() - started;
  const healthy =
    checks.database === 'ok' && checks.knuct !== 'error' && checks.redis !== 'error';

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      service: 'aimscs',
      version: process.env.npm_package_version ?? '0.2.0',
      checks,
      redis: redisMeta,
      knuct: knuctMeta,
      latencyMs,
    },
    { status: healthy ? 200 : 503 }
  );
}
