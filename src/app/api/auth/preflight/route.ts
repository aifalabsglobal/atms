import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/audit';
import { isPlaceholderPasswordHash, verifyPlaceholderPassword } from '@/lib/demo-mode';

export const dynamic = 'force-dynamic';

/**
 * Password preflight — tells the login UI whether MFA is required
 * without creating a session.
 */
export async function POST(request: Request) {
  const limited = await enforceRateLimit(`auth-preflight:${getClientIp(request) ?? 'anon'}`, 20, 60_000);
  if (limited) return limited;

  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    if (!email || !password) {
      return NextResponse.json({ error: 'email and password required' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { email },
      select: { passwordHash: true, status: true, mfaEnabled: true },
    });
    if (!user || user.status !== 'active') {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const valid = isPlaceholderPasswordHash(user.passwordHash)
      ? verifyPlaceholderPassword(password)
      : await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    return NextResponse.json({ ok: true, mfaRequired: user.mfaEnabled === true });
  } catch (err) {
    console.error('[auth] preflight error:', err);
    return NextResponse.json({ error: 'Preflight failed' }, { status: 500 });
  }
}
