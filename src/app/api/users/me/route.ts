import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAuth } from '@/lib/auth-helpers';
import { logAudit, getClientIp } from '@/lib/audit';
import { enforceRateLimit } from '@/lib/rate-limit';
import { resolveDisplayAvatarUrl } from '@/lib/user-management';

const PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  employeeId: true,
  department: true,
  departmentId: true,
  phone: true,
  role: true,
  status: true,
  avatarUrl: true,
  profileImageUrl: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

function shapeProfile(user: {
  avatarUrl: string | null;
  profileImageUrl: string | null;
  [key: string]: unknown;
}) {
  const displayAvatar = resolveDisplayAvatarUrl(user.profileImageUrl, user.avatarUrl);
  return {
    ...user,
    avatarUrl: displayAvatar,
    profileImageUrl: displayAvatar,
  };
}

export async function GET() {
  try {
    const { error, session } = await requireAuth();
    if (error || !session) return error;

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: PROFILE_SELECT,
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user: shapeProfile(user) });
  } catch (error) {
    console.error('My profile GET error:', error);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const limited = await enforceRateLimit(`users-me:${getClientIp(request) ?? 'anon'}`, 20, 60_000);
    if (limited) return limited;

    const { error, session } = await requireAuth();
    if (error || !session) return error;

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 });
      }
      data.name = name;
    }

    if (body.phone !== undefined) {
      data.phone = typeof body.phone === 'string' ? body.phone.trim() || null : null;
    }

    if (body.currentPassword || body.newPassword) {
      const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
      const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
      if (!currentPassword || !newPassword) {
        return NextResponse.json(
          { error: 'currentPassword and newPassword are required to change password' },
          { status: 400 },
        );
      }

      const account = await db.user.findUnique({
        where: { id: session.user.id },
        select: { passwordHash: true },
      });
      if (!account?.passwordHash) {
        return NextResponse.json({ error: 'Password change is not available for this account' }, { status: 400 });
      }

      const valid = await bcrypt.compare(currentPassword, account.passwordHash);
      if (!valid) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
      }

      const { getAuthSettings, validatePasswordAgainstPolicy } = await import('@/lib/settings/auth-config');
      const authSettings = await getAuthSettings();
      const policyError = validatePasswordAgainstPolicy(newPassword, authSettings);
      if (policyError) {
        return NextResponse.json({ error: policyError }, { status: 400 });
      }

      data.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const user = await db.user.update({
      where: { id: session.user.id },
      data,
      select: PROFILE_SELECT,
    });

    await logAudit({
      userId: session.user.id,
      action: data.passwordHash ? 'user.change_password' : 'user.update_profile',
      resource: `user:${session.user.id}`,
      details: {
        fields: Object.keys(data).filter((k) => k !== 'passwordHash'),
      },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({
      user: shapeProfile(user),
      passwordChanged: Boolean(data.passwordHash),
    });
  } catch (error) {
    console.error('My profile PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
