/**
 * DID Auth API — two-step endpoint (requires NextAuth session)
 *
 * POST /api/knuct/did-auth  { step: 'challenge', hash: string }
 *   → { challenge: string }
 *
 * POST /api/knuct/did-auth  { step: 'complete', response: number[] }
 *   → { did: string }
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { purgeDIDAuthSessions } from '@/lib/knuct/did-auth-session';
import { persistKnuctSessionForUser, persistVerifiedDid, runDidAuthChallenge, runDidAuthComplete } from '@/lib/knuct/did-auth-flow';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await purgeDIDAuthSessions();

  const body = (await req.json()) as { step?: string; hash?: string; response?: number[] };
  const { step } = body;
  const sessionKey = session.user.id;

  if (step === 'challenge') {
    const { hash } = body;
    if (!hash || typeof hash !== 'string') {
      return NextResponse.json({ error: 'hash is required' }, { status: 400 });
    }

    try {
      const challenge = await runDidAuthChallenge(sessionKey, hash);
      return NextResponse.json({ challenge });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Challenge request failed';
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  if (step === 'complete') {
    const { response } = body;
    if (!Array.isArray(response) || response.length === 0) {
      return NextResponse.json({ error: 'response array is required' }, { status: 400 });
    }

    try {
      const { did, sessionCookies } = await runDidAuthComplete(sessionKey, response);
      await persistVerifiedDid(session.user.id, did);
      const { accountInfo } = await persistKnuctSessionForUser(session.user.id, sessionCookies);
      return NextResponse.json({ did, accountInfo: accountInfo ?? null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'DID auth completion failed';
      const status = msg.includes('expired') ? 409 : 502;
      return NextResponse.json({ error: msg }, { status });
    }
  }

  return NextResponse.json({ error: 'step must be "challenge" or "complete"' }, { status: 400 });
}
