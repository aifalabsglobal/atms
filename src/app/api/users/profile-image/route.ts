import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAuth, ADMIN_ROLES } from '@/lib/auth-helpers';
import { uploadImageFromBase64 } from '@/lib/object-storage';
import { rateLimitByUser } from '@/lib/api-rate-limit';
import { canAssignRole } from '@/lib/user-management';
import type { Role } from '@/lib/store';

export async function POST(request: Request) {
  try {
    const { error, session } = await requireAuth();
    if (error || !session) return error;

    const limited = await rateLimitByUser(request, session.user.id, 'profile-image', 10, 60_000);
    if (limited) return limited;

    const body = await request.json();
    const { userId, imageBase64 } = body;

    if (!userId || !imageBase64) {
      return NextResponse.json({ error: 'userId and imageBase64 are required' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isSelf = userId === session.user.id;
    const actorRole = session.user.role as Role;
    const isAdmin = ADMIN_ROLES.includes(actorRole);
    const canManageTarget = canAssignRole(actorRole, user.role as Role);
    if (!isSelf && !isAdmin && !canManageTarget) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { url: profileImageUrl } = await uploadImageFromBase64('profiles', userId, imageBase64);

    // Keep legacy avatarUrl in sync so list/detail UIs that still read it stay correct.
    await db.user.update({
      where: { id: userId },
      data: { profileImageUrl, avatarUrl: profileImageUrl },
    });

    return NextResponse.json({ success: true, profileImageUrl, avatarUrl: profileImageUrl });
  } catch (error) {
    console.error('Profile image upload error:', error);
    return NextResponse.json({ error: 'Failed to upload profile image' }, { status: 500 });
  }
}
