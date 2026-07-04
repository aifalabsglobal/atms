import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getKnuctDashboardStats,
  getKnuctHealth,
  getUserKnuctWallet,
  provisionWallet,
} from '@/lib/knuct';
import { getKnuctConfig } from '@/lib/knuct/config';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = session.user.role;
    const config = getKnuctConfig();

    if (role === 'super_admin') {
      const [health, stats, ownWallet] = await Promise.all([
        getKnuctHealth(),
        getKnuctDashboardStats(),
        getUserKnuctWallet(session.user.id),
      ]);
      return NextResponse.json({ config, health, stats, wallet: ownWallet });
    }

    if (role === 'admin') {
      const [health, ownWallet] = await Promise.all([
        getKnuctHealth(),
        getUserKnuctWallet(session.user.id),
      ]);
      return NextResponse.json({ config, health, wallet: ownWallet });
    }

    const ownWallet = await getUserKnuctWallet(session.user.id);
    const health = await getKnuctHealth();
    return NextResponse.json({ config, health, wallet: ownWallet });
  } catch (error) {
    console.error('[knuct] status error:', error);
    return NextResponse.json({ error: 'Failed to load Knuct status' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit(`knuct-provision:${getClientIp(request) ?? 'anon'}`, 10, 60_000);
    if (limited) return limited;

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = session.user.role;
    const body = await request.json().catch(() => ({}));
    const targetUserId = (body.userId as string | undefined) ?? session.user.id;

    if (targetUserId !== session.user.id && role !== 'super_admin' && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await provisionWallet(targetUserId);
    const wallet = await getUserKnuctWallet(targetUserId);
    return NextResponse.json({ wallet });
  } catch (error) {
    console.error('[knuct] provision error:', error);
    return NextResponse.json({ error: 'Wallet provisioning failed' }, { status: 500 });
  }
}
