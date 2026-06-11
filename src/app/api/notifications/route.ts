import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const notifications = await db.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    const unreadCount = await db.notification.count({ where: { isRead: false } });
    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Notifications API error:', error);
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 });
  }
}
