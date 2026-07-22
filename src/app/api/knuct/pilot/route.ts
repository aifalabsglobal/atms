import { NextResponse } from 'next/server';
import { getKnuctConfig } from '@/lib/knuct/config';
import { getKnuctHealth } from '@/lib/knuct/stats';
import { startPilotProvisioning } from '@/lib/knuct/pilot-service';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/audit';
import { requireKnuctOpsAccess } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const { error, session } = await requireKnuctOpsAccess();
    if (error || !session) return error;

    const config = getKnuctConfig();
    const health = await getKnuctHealth();

    return NextResponse.json({
      pilotReady: config.enabled,
      config: {
        enabled: config.enabled,
        baseUrl: config.baseUrl,
        walletOnUserCreate: config.walletOnUserCreate,
        pilotCohortLimit: config.pilotCohortLimit,
        hasApiKey: Boolean(config.apiKey),
        hasTenantId: Boolean(config.tenantId),
      },
      health,
    });
  } catch (err) {
    console.error('[knuct] pilot status error:', err);
    return NextResponse.json({ error: 'Failed to load pilot status' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit(`knuct-pilot:${getClientIp(request) ?? 'anon'}`, 5, 60_000);
    if (limited) return limited;

    const { error, session } = await requireKnuctOpsAccess();
    if (error || !session) return error;

    const body = await request.json().catch(() => ({}));
    const result = await startPilotProvisioning({
      userIds: body.userIds as string[] | undefined,
      emails: body.emails as string[] | undefined,
      roles: body.roles as string[] | undefined,
      limit: body.limit as number | undefined,
      sync: body.sync === true,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[knuct] pilot start error:', err);
    return NextResponse.json({ error: 'Pilot failed' }, { status: 500 });
  }
}
