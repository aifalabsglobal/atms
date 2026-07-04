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

export async function PATCH(request: Request) {
  try {
    const { error, session } = await requireAuth();
    if (error || !session) return error;

    const body = await request.json().catch(() => ({}));
    const all = body.all === true;
    const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];

    if (all) {
      await db.notification.updateMany({
        where: { userId: session.user.id, isRead: false },
        data: { isRead: true },
      });
    } else if (ids.length > 0) {
      await db.notification.updateMany({
        where: { userId: session.user.id, id: { in: ids } },
        data: { isRead: true },
      });
    } else {
      return NextResponse.json({ error: 'Provide ids or all: true' }, { status: 400 });
    }

    const unreadCount = await db.notification.count({
      where: { userId: session.user.id, isRead: false },
    });
    return NextResponse.json({ ok: true, unreadCount });
  } catch (error) {
    console.error('Notifications PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
  }
}
