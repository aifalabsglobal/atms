import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';

export async function GET() {
  try {
    const { error, session } = await requireAuth();
    if (error || !session) return error;

    const notifications = await db.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    const unreadCount = await db.notification.count({
      where: { userId: session.user.id, isRead: false },
    });
    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Notifications API error:', error);
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 });
  }
}
