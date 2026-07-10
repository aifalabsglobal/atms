import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAuth, ADMIN_ROLES } from '@/lib/auth-helpers';
import { uploadImageFromBase64 } from '@/lib/object-storage';
import { rateLimitByUser } from '@/lib/api-rate-limit';

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

    const isSelf = userId === session.user.id;
    const isAdmin = ADMIN_ROLES.includes(session.user.role);
    if (!isSelf && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { url: profileImageUrl } = await uploadImageFromBase64('profiles', userId, imageBase64);

    await db.user.update({
      where: { id: userId },
      data: { profileImageUrl },
    });

    return NextResponse.json({ success: true, profileImageUrl });
  } catch (error) {
    console.error('Profile image upload error:', error);
    return NextResponse.json({ error: 'Failed to upload profile image' }, { status: 500 });
  }
}
