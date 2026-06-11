import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const courseId = searchParams.get('courseId');
    const captureMethod = searchParams.get('captureMethod');
    const date = searchParams.get('date');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (courseId) where.courseId = courseId;
    if (captureMethod) where.captureMethod = captureMethod;
    if (date) where.sessionDate = date;

    const [sessions, total] = await Promise.all([
      db.attendanceSession.findMany({
        where,
        include: {
          course: { select: { name: true, code: true } },
          creator: { select: { name: true } },
          geofence: { select: { name: true } },
          timetableSlot: { select: { roomNumber: true, building: true, startTime: true, endTime: true } },
          _count: { select: { records: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.attendanceSession.count({ where }),
    ]);

    // Summary stats
    const totalSessions = await db.attendanceSession.count();
    const activeCount = await db.attendanceSession.count({ where: { status: 'active' } });
    const completedCount = await db.attendanceSession.count({ where: { status: 'completed' } });
    const avgAttendance = await db.attendanceSession.aggregate({
      _avg: { presentCount: true, expectedCount: true },
      where: { status: 'completed' },
    });

    return NextResponse.json({
      sessions, total, page, limit,
      summary: {
        totalSessions,
        activeCount,
        completedCount,
        avgAttendanceRate: avgAttendance._avg.expectedCount && avgAttendance._avg.presentCount
          ? Math.round(((avgAttendance._avg.presentCount / avgAttendance._avg.expectedCount) * 100))
          : 0,
      }
    });
  } catch (error) {
    console.error('Attendance sessions API error:', error);
    return NextResponse.json({ error: 'Failed to load attendance sessions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { courseId, createdBy, sessionDate, startTime, endTime, captureMethod, geofenceId, timetableSlotId, expectedCount } = body;

    const session = await db.attendanceSession.create({
      data: {
        courseId, createdBy, sessionDate, startTime, endTime,
        captureMethod: captureMethod || 'manual',
        geofenceId, timetableSlotId,
        expectedCount: expectedCount || 0,
        status: 'active',
      },
      include: { course: { select: { name: true, code: true } } },
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error('Create session error:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}
