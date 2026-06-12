import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    const sessions = await db.attendanceSession.findMany({
      where: { status: 'active' },
      include: {
        course: { select: { name: true, code: true } },
        geofence: { select: { name: true, centerLat: true, centerLng: true, radiusMtrs: true } },
        timetableSlot: { select: { roomNumber: true, building: true, startTime: true, endTime: true } },
        creator: { select: { name: true } },
        records: studentId ? { where: { studentId } } : false,
      },
      orderBy: { createdAt: 'desc' },
    });

    const enriched = sessions.map((s) => {
      const alreadyMarked = studentId ? (s.records as unknown[]).length > 0 : false;
      const existingRecord = studentId && (s.records as unknown[]).length > 0 ? (s.records as { id: string; status: string; faceVerified: boolean; geofenceValidated: boolean; selfieUrl?: string; gpsLat?: number; gpsLng?: number; confidence?: number; distanceFromCenter?: number; captureMethod: string }[])[0] : null;
      const { records: _records, ...rest } = s;
      void _records;
      return { ...rest, alreadyMarked, existingRecord };
    });

    return NextResponse.json({ sessions: enriched, total: enriched.length });
  } catch (error) {
    console.error('Active sessions API error:', error);
    return NextResponse.json({ error: 'Failed to load active sessions' }, { status: 500 });
  }
}
