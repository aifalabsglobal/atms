import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getKnuctHealth } from '@/lib/knuct';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

  try {
    const knuct = await getKnuctHealth();
    checks.knuct =
      knuct.health === 'ok' ? 'ok' : knuct.health === 'degraded' ? 'degraded' : 'error';
  } catch (err) {
    console.error('[health] knuct check failed:', err);
    checks.knuct = 'error';
  }

  const latencyMs = Date.now() - started;
  const healthy = checks.database === 'ok' && checks.knuct !== 'error';

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      service: 'jntuh-scms',
      version: process.env.npm_package_version ?? '0.2.0',
      checks,
      latencyMs,
    },
    { status: healthy ? 200 : 503 }
  );
}
