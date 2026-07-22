/**
 * Public Knuct registration — DID verify + profile submission
 *
 * POST { step: 'challenge', hash }
 * POST { step: 'complete', flowId, response, name, email, ... }
 */
import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit';
import { runDidAuthChallenge, runDidAuthComplete } from '@/lib/knuct/did-auth-flow';
import { createRegistrationRequest, createRegistrationPendingWallet } from '@/lib/knuct/registration-service';
import { purgeDIDAuthSessions } from '@/lib/knuct/did-auth-session';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'anon';
  return req.headers.get('x-real-ip') ?? 'anon';
}

export async function POST(req: Request) {
  const limited = await enforceRateLimit(`register:${clientIp(req)}`, 8, 60_000);
  if (limited) return limited;

  const { getAuthSettings } = await import('@/lib/settings/auth-config');
  const authSettings = await getAuthSettings();
  if (!authSettings.selfRegistrationEnabled) {
    return NextResponse.json({ error: 'Self-registration is disabled' }, { status: 403 });
  }

  // Public /knuct/register — no console session yet.
  await purgeDIDAuthSessions();

  const body = (await req.json()) as {
    step?: string;
    hash?: string;
    flowId?: string;
    response?: number[];
    name?: string;
    email?: string;
    employeeId?: string;
    phone?: string;
    departmentId?: string;
    department?: string;
    requestedRole?: string;
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

  if (step === 'create-wallet') {
    const { name, email } = body;
    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json({ error: 'name and email are required' }, { status: 400 });
    }

    try {
      const result = await createRegistrationPendingWallet({
        name,
        email,
        employeeId: body.employeeId,
        phone: body.phone,
        departmentId: body.departmentId,
        department: body.department,
        requestedRole: body.requestedRole,
      });

      return NextResponse.json({
        id: result.request.id,
        did: result.request.did,
        status: result.request.status,
        walletSource: 'pending_create',
        message: result.message,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Wallet creation failed';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  if (step === 'complete') {
    const { flowId, response, name, email } = body;
    if (!flowId || typeof flowId !== 'string') {
      return NextResponse.json({ error: 'flowId is required' }, { status: 400 });
    }
    if (!Array.isArray(response) || response.length === 0) {
      return NextResponse.json({ error: 'response array is required' }, { status: 400 });
    }
    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json({ error: 'name and email are required' }, { status: 400 });
    }

    try {
      const { did } = await runDidAuthComplete(flowId, response);
      const request = await createRegistrationRequest(did, {
        name,
        email,
        employeeId: body.employeeId,
        phone: body.phone,
        departmentId: body.departmentId,
        department: body.department,
        requestedRole: body.requestedRole,
      });

      return NextResponse.json({
        id: request.id,
        did: request.did,
        status: request.status,
        message: 'Registration submitted. An administrator will review your request.',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      const status =
        msg.includes('expired') ? 409 :
        msg.includes('already') ? 409 :
        400;
      return NextResponse.json({ error: msg }, { status });
    }
  }

  return NextResponse.json({ error: 'step must be "challenge" or "complete"' }, { status: 400 });
}
