/**
 * Knuct DID login — unauthenticated two-step flow
 *
 * POST { step: 'challenge', hash: string }
 *   → { flowId, challenge }
 *
 * POST { step: 'complete', flowId: string, response: number[] }
 *   → { did, loginToken }  (exchange loginToken via signIn('knuct', { loginToken }))
 */
import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit';
import { findActiveUserByDid, runDidAuthChallenge, runDidAuthComplete } from '@/lib/knuct/did-auth-flow';
import { createKnuctLoginGrant } from '@/lib/knuct/login-grant';
import { purgeDIDAuthSessions } from '@/lib/knuct/did-auth-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'anon';
  return req.headers.get('x-real-ip') ?? 'anon';
}

export async function POST(req: Request) {
  const limited = await enforceRateLimit(`knuct-login:${clientIp(req)}`, 10, 60_000);
  if (limited) return limited;

  purgeDIDAuthSessions();

  const body = (await req.json()) as {
    step?: string;
    hash?: string;
    flowId?: string;
    response?: number[];
  };
  const { step } = body;

  if (step === 'challenge') {
    const { hash } = body;
    if (!hash || typeof hash !== 'string') {
      return NextResponse.json({ error: 'hash is required' }, { status: 400 });
    }

    const flowId = randomBytes(16).toString('hex');
    try {
      const challenge = await runDidAuthChallenge(flowId, hash);
      return NextResponse.json({ flowId, challenge });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Challenge request failed';
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  if (step === 'complete') {
    const { flowId, response } = body;
    if (!flowId || typeof flowId !== 'string') {
      return NextResponse.json({ error: 'flowId is required' }, { status: 400 });
    }
    if (!Array.isArray(response) || response.length === 0) {
      return NextResponse.json({ error: 'response array is required' }, { status: 400 });
    }

    try {
      const did = await runDidAuthComplete(flowId, response);
      const user = await findActiveUserByDid(did);
      if (!user) {
        return NextResponse.json(
          {
            error:
              'No SCMS account is linked to this DID. Sign in with email first, or ask an admin to provision your Knuct wallet.',
          },
          { status: 404 }
        );
      }

      const loginToken = createKnuctLoginGrant(user.id);
      return NextResponse.json({ did, loginToken });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'DID login failed';
      const status = msg.includes('expired') ? 409 : 502;
      return NextResponse.json({ error: msg }, { status });
    }
  }

  return NextResponse.json({ error: 'step must be "challenge" or "complete"' }, { status: 400 });
}
