import { NextResponse } from 'next/server';
import {
  requireKnuctConsoleSession,
  requireKnuctOpsAccess,
} from '@/lib/auth-helpers';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/audit';
import {
  approveWalletProvisionRequest,
  createWalletProvisionRequest,
  listWalletProvisionRequests,
  rejectWalletProvisionRequest,
  type WalletProvisionRequestType,
} from '@/lib/knuct/wallet-provision-request-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { error, session } = await requireKnuctOpsAccess();
    if (error || !session) return error;

    const status = new URL(req.url).searchParams.get('status') ?? 'pending';
    const requests = await listWalletProvisionRequests(status);
    return NextResponse.json({ requests, total: requests.length });
  } catch (err) {
    console.error('[knuct/wallet-requests] GET error:', err);
    return NextResponse.json({ error: 'Failed to load wallet provision requests' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const limited = await enforceRateLimit(
      `knuct-wallet-request:${getClientIp(req) ?? 'anon'}`,
      12,
      60_000
    );
    if (limited) return limited;

    const body = (await req.json()) as {
      action?: 'request' | 'approve' | 'reject';
      requestType?: WalletProvisionRequestType;
      userNote?: string;
      id?: string;
      reason?: string;
    };

    if (body.action === 'request') {
      const { error, session } = await requireKnuctConsoleSession();
      if (error || !session) return error;

      const requestType = body.requestType;
      if (requestType !== 'create' && requestType !== 'reprovision') {
        return NextResponse.json({ error: 'requestType must be create or reprovision' }, { status: 400 });
      }

      const request = await createWalletProvisionRequest({
        userId: session.user.id,
        requestType,
        userNote: body.userNote,
      });

      return NextResponse.json({
        ok: true,
        request: {
          id: request.id,
          requestType: request.requestType,
          status: request.status,
          createdAt: request.createdAt,
        },
        message: 'Wallet request submitted. A Knuct console operator must approve it before provisioning runs.',
      });
    }

    if (body.action === 'approve' || body.action === 'reject') {
      const { error, session } = await requireKnuctOpsAccess();
      if (error || !session) return error;

      if (!body.id) {
        return NextResponse.json({ error: 'id is required' }, { status: 400 });
      }

      if (body.action === 'approve') {
        const approved = await approveWalletProvisionRequest({
          requestId: body.id,
          reviewerId: session.user.id,
        });
        return NextResponse.json({
          ok: true,
          message: 'Wallet provisioning started after approval.',
          request: {
            id: approved.id,
            userId: approved.userId,
            requestType: approved.requestType,
          },
        });
      }

      await rejectWalletProvisionRequest({
        requestId: body.id,
        reviewerId: session.user.id,
        reason: body.reason,
      });
      return NextResponse.json({ ok: true, message: 'Wallet request rejected.' });
    }

    return NextResponse.json({ error: 'action must be request, approve, or reject' }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Wallet request failed';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
