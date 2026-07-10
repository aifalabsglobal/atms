import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { buildMfaOtpauthUrl, generateMfaSecret, verifyMfaToken } from '@/lib/mfa';
import { logAudit, getClientIp } from '@/lib/audit';
import { rateLimitByUser } from '@/lib/api-rate-limit';

export const dynamic = 'force-dynamic';

/** Start MFA enrollment — returns secret + QR data URL (not yet enabled). */
export async function POST(request: Request) {
  try {
    const { error, session } = await requireAuth();
    if (error || !session) return error;

    const limited = await rateLimitByUser(request, session.user.id, 'mfa-setup', 10, 60_000);
    if (limited) return limited;

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, mfaEnabled: true },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (user.mfaEnabled) {
      return NextResponse.json({ error: 'MFA is already enabled' }, { status: 409 });
    }

    const secret = generateMfaSecret();
    const otpauthUrl = buildMfaOtpauthUrl(user.email, secret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

    await db.user.update({
      where: { id: session.user.id },
      data: { mfaSecret: secret, mfaEnabled: false },
    });

    return NextResponse.json({ secret, otpauthUrl, qrDataUrl });
  } catch (err) {
    console.error('[mfa] setup error:', err);
    return NextResponse.json({ error: 'Failed to start MFA setup' }, { status: 500 });
  }
}

/** Confirm MFA with a TOTP code — enables MFA. */
export async function PUT(request: Request) {
  try {
    const { error, session } = await requireAuth();
    if (error || !session) return error;

    const limited = await rateLimitByUser(request, session.user.id, 'mfa-confirm', 15, 60_000);
    if (limited) return limited;

    const body = await request.json().catch(() => ({}));
    const token = String(body.token ?? '').trim();

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { mfaSecret: true, mfaEnabled: true },
    });
    if (!user?.mfaSecret) {
      return NextResponse.json({ error: 'Start MFA setup first' }, { status: 400 });
    }
    if (!verifyMfaToken(user.mfaSecret, token)) {
      return NextResponse.json({ error: 'Invalid authenticator code' }, { status: 400 });
    }

    await db.user.update({
      where: { id: session.user.id },
      data: { mfaEnabled: true },
    });

    await logAudit({
      userId: session.user.id,
      action: 'mfa.enable',
      resource: `user:${session.user.id}`,
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ enabled: true });
  } catch (err) {
    console.error('[mfa] confirm error:', err);
    return NextResponse.json({ error: 'Failed to enable MFA' }, { status: 500 });
  }
}

/** Disable MFA (requires current TOTP). */
export async function DELETE(request: Request) {
  try {
    const { error, session } = await requireAuth();
    if (error || !session) return error;

    const limited = await rateLimitByUser(request, session.user.id, 'mfa-disable', 10, 60_000);
    if (limited) return limited;

    const body = await request.json().catch(() => ({}));
    const token = String(body.token ?? '').trim();

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { mfaSecret: true, mfaEnabled: true },
    });
    if (!user?.mfaEnabled || !user.mfaSecret) {
      return NextResponse.json({ error: 'MFA is not enabled' }, { status: 400 });
    }
    if (!verifyMfaToken(user.mfaSecret, token)) {
      return NextResponse.json({ error: 'Invalid authenticator code' }, { status: 400 });
    }

    await db.user.update({
      where: { id: session.user.id },
      data: { mfaEnabled: false, mfaSecret: null },
    });

    await logAudit({
      userId: session.user.id,
      action: 'mfa.disable',
      resource: `user:${session.user.id}`,
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ enabled: false });
  } catch (err) {
    console.error('[mfa] disable error:', err);
    return NextResponse.json({ error: 'Failed to disable MFA' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { error, session } = await requireAuth();
    if (error || !session) return error;

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { mfaEnabled: true },
    });
    return NextResponse.json({ enabled: user?.mfaEnabled === true });
  } catch (err) {
    console.error('[mfa] status error:', err);
    return NextResponse.json({ error: 'Failed to load MFA status' }, { status: 500 });
  }
}
