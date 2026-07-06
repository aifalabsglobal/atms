/**
 * DID Auth API — two-step endpoint
 *
 * POST /api/knuct/did-auth  { step: 'challenge', hash: string }
 *   → { challenge: string }
 *
 * POST /api/knuct/did-auth  { step: 'complete', response: number[] }
 *   → { did: string }
 *
 * The client must call these in order. Between steps, the same
 * KnuctHttpAdapter (with its Knuct session cookies) is held in memory
 * keyed by the authenticated user's ID.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  createDIDAuthSession,
  deleteDIDAuthSession,
  getDIDAuthSession,
  purgeDIDAuthSessions,
} from '@/lib/knuct/did-auth-session';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  purgeDIDAuthSessions();

  const body = await req.json() as { step?: string; hash?: string; response?: number[] };
  const { step } = body;

  // ── Step 1: challenge ─────────────────────────────────────────────────
  if (step === 'challenge') {
    const { hash } = body;
    if (!hash || typeof hash !== 'string') {
      return NextResponse.json({ error: 'hash is required' }, { status: 400 });
    }

    const adapter = createDIDAuthSession(session.user.id);
    try {
      const challenge = await adapter.authChallenge(hash);
      return NextResponse.json({ challenge });
    } catch (err) {
      deleteDIDAuthSession(session.user.id);
      const msg = err instanceof Error ? err.message : 'Challenge request failed';
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  // ── Step 2: complete ──────────────────────────────────────────────────
  if (step === 'complete') {
    const { response } = body;
    if (!Array.isArray(response) || response.length === 0) {
      return NextResponse.json({ error: 'response array is required' }, { status: 400 });
    }

    const adapter = getDIDAuthSession(session.user.id);
    if (!adapter) {
      return NextResponse.json(
        { error: 'DID auth session expired — please start again' },
        { status: 409 }
      );
    }

    try {
      await adapter.authResponse(response);
      await adapter.startNode();
      const walletData = await adapter.walletData();

      // Persist the verified DID into the user's knuct wallet record
      await db.knuctWallet.upsert({
        where: { userId: session.user.id },
        create: {
          userId: session.user.id,
          did: walletData.did,
          status: 'active',
        },
        update: {
          did: walletData.did,
          status: 'active',
          lastError: null,
        },
      });

      deleteDIDAuthSession(session.user.id);
      return NextResponse.json({ did: walletData.did });
    } catch (err) {
      deleteDIDAuthSession(session.user.id);
      const msg = err instanceof Error ? err.message : 'DID auth completion failed';
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  return NextResponse.json({ error: 'step must be "challenge" or "complete"' }, { status: 400 });
}
