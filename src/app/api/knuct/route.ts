import { NextResponse } from 'next/server';
import {
  getKnuctDashboardStats,
  getKnuctHealth,
  getUserKnuctWallet,
  queueWalletProvision,
} from '@/lib/knuct';
import { getKnuctPublicConfig } from '@/lib/knuct/config';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/audit';
import {
  requireKnuctConsoleSession,
  requireKnuctOpsAccess,
} from '@/lib/auth-helpers';
import {
  getPendingWalletProvisionRequest,
} from '@/lib/knuct/wallet-provision-request-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const { error, session } = await requireKnuctConsoleSession();
    if (error || !session) return error;

    const config = getKnuctPublicConfig();
    const isOps = session.user.knuctConsoleAccess === true;

    if (isOps) {
      const [health, stats, ownWallet, provisionRequest] = await Promise.all([
        getKnuctHealth(),
        getKnuctDashboardStats(),
        getUserKnuctWallet(session.user.id),
        getPendingWalletProvisionRequest(session.user.id),
      ]);
      return NextResponse.json({
        config,
        health,
        stats,
        wallet: ownWallet,
        provisionRequest,
        knuctConsoleAccess: true,
      });
    }

    const [ownWallet, health, provisionRequest] = await Promise.all([
      getUserKnuctWallet(session.user.id),
      getKnuctHealth(),
      getPendingWalletProvisionRequest(session.user.id),
    ]);
    return NextResponse.json({
      config,
      health,
      wallet: ownWallet,
      provisionRequest,
      knuctConsoleAccess: false,
    });
  } catch (error) {
    console.error('[knuct] status error:', error);
    return NextResponse.json({ error: 'Failed to load Knuct status' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit(`knuct-provision:${getClientIp(request) ?? 'anon'}`, 10, 60_000);
    if (limited) return limited;

    const { error, session } = await requireKnuctOpsAccess();
    if (error || !session) return error;

    const body = await request.json().catch(() => ({}));
    const targetUserId = (body.userId as string | undefined) ?? session.user.id;

    const result = await queueWalletProvision(targetUserId);
    const wallet = await getUserKnuctWallet(targetUserId);
    return NextResponse.json({ wallet, queued: true });
  } catch (error) {
    console.error('[knuct] provision error:', error);
    return NextResponse.json({ error: 'Failed to queue wallet provision' }, { status: 500 });
  }
}
