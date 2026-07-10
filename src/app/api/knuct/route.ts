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
import { requireAuth, canAccessSection } from '@/lib/auth-helpers';
import {
  getPendingWalletProvisionRequest,
  isWalletProvisionerRole,
} from '@/lib/knuct/wallet-provision-request-service';
import type { Role } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const { error, session } = await requireAuth();
    if (error || !session) return error;

    const role = session.user.role as Role;
    const config = getKnuctPublicConfig();
    const hasSettings = await canAccessSection(role, 'settings', session.user.id);

    if (role === 'super_admin' && hasSettings) {
      const [health, stats, ownWallet, provisionRequest] = await Promise.all([
        getKnuctHealth(),
        getKnuctDashboardStats(),
        getUserKnuctWallet(session.user.id),
        getPendingWalletProvisionRequest(session.user.id),
      ]);
      return NextResponse.json({ config, health, stats, wallet: ownWallet, provisionRequest });
    }

    if (role === 'admin' && hasSettings) {
      const [health, ownWallet, provisionRequest] = await Promise.all([
        getKnuctHealth(),
        getUserKnuctWallet(session.user.id),
        getPendingWalletProvisionRequest(session.user.id),
      ]);
      return NextResponse.json({ config, health, wallet: ownWallet, provisionRequest });
    }

    const [ownWallet, health, provisionRequest] = await Promise.all([
      getUserKnuctWallet(session.user.id),
      getKnuctHealth(),
      getPendingWalletProvisionRequest(session.user.id),
    ]);
    return NextResponse.json({ config, health, wallet: ownWallet, provisionRequest });
  } catch (error) {
    console.error('[knuct] status error:', error);
    return NextResponse.json({ error: 'Failed to load Knuct status' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit(`knuct-provision:${getClientIp(request) ?? 'anon'}`, 10, 60_000);
    if (limited) return limited;

    const { error, session } = await requireAuth();
    if (error || !session) return error;

    const role = session.user.role as Role;
    const body = await request.json().catch(() => ({}));
    const targetUserId = (body.userId as string | undefined) ?? session.user.id;

    if (targetUserId !== session.user.id) {
      const hasSettings = await canAccessSection(role, 'settings', session.user.id);
      if (!hasSettings || !isWalletProvisionerRole(role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else if (!isWalletProvisionerRole(role)) {
      return NextResponse.json(
        {
          error:
            'Wallet provisioning requires administrator approval. Submit a request from your dashboard wallet panel.',
        },
        { status: 403 }
      );
    }

    await queueWalletProvision(targetUserId);
    const wallet = await getUserKnuctWallet(targetUserId);
    return NextResponse.json({ wallet, queued: true });
  } catch (error) {
    console.error('[knuct] provision error:', error);
    return NextResponse.json({ error: 'Wallet provisioning failed' }, { status: 500 });
  }
}
