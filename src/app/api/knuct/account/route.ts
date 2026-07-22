import { NextResponse } from 'next/server';
import { requireKnuctConsoleSession } from '@/lib/auth-helpers';
import { fetchKnuctCapiBundle } from '@/lib/knuct/capi-service';
import { getKnuctPublicConfig } from '@/lib/knuct/config';
import { knuctKvBackend } from '@/lib/knuct/redis-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Live Knuct CAPI data — requires Knuct console session (after DID login). */
export async function GET() {
  try {
    const { error, session } = await requireKnuctConsoleSession();
    if (error || !session) return error;

    const config = getKnuctPublicConfig();
    const capi = await fetchKnuctCapiBundle(session.user.id);

    return NextResponse.json({
      config,
      sessionStore: knuctKvBackend(),
      sessionActive: capi.sessionActive,
      accountInfo: capi.accountInfo,
      dashboard: capi.dashboard,
    });
  } catch (err) {
    console.error('[knuct] account CAPI error:', err);
    return NextResponse.json({ error: 'Failed to load Knuct account data' }, { status: 500 });
  }
}
