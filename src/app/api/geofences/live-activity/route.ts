import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireGeofenceRead } from '@/lib/geofence-api';

/** Live session counts per geofence — readable with geofences section only (visitors OK). */
export async function GET() {
  try {
    const { error } = await requireGeofenceRead();
    if (error) return error;

    const sessions = await db.attendanceSession.findMany({
      where: { status: 'active', geofenceId: { not: null } },
      select: {
        id: true,
        geofenceId: true,
        presentCount: true,
        expectedCount: true,
        course: { select: { name: true, code: true } },
      },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });

    const byGeofence = new Map<
      string,
      {
        geofenceId: string;
        sessionCount: number;
        sessions: {
          id: string;
          courseCode: string;
          courseName: string;
          presentCount: number;
          expectedCount: number;
        }[];
      }
    >();

    for (const s of sessions) {
      if (!s.geofenceId) continue;
      const row = byGeofence.get(s.geofenceId) ?? {
        geofenceId: s.geofenceId,
        sessionCount: 0,
        sessions: [],
      };
      row.sessionCount += 1;
      row.sessions.push({
        id: s.id,
        courseCode: s.course.code,
        courseName: s.course.name,
        presentCount: s.presentCount,
        expectedCount: s.expectedCount,
      });
      byGeofence.set(s.geofenceId, row);
    }

    return NextResponse.json({
      byGeofence: Array.from(byGeofence.values()),
      totalActiveSessions: sessions.length,
    });
  } catch (error) {
    console.error('Geofence live-activity API error:', error);
    return NextResponse.json({ error: 'Failed to load live activity' }, { status: 500 });
  }
}
