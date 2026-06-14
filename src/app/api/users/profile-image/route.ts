import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAuth, ADMIN_ROLES } from '@/lib/auth-helpers';

export async function POST(request: Request) {
  try {
    const { error, session } = await requireAuth();
    if (error || !session) return error;

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

    const profilesDir = path.join(process.cwd(), 'public', 'profiles');
    if (!fs.existsSync(profilesDir)) fs.mkdirSync(profilesDir, { recursive: true });

    const filename = `${userId}.png`;
    const filepath = path.join(profilesDir, filename);
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'));

    const profileImageUrl = `/profiles/${filename}`;

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
