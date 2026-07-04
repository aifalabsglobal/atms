import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAuth, STAFF_ROLES, requireRoles, requireCampusRead, getCampusScope, assertCourseInScope } from '@/lib/auth-helpers';
import { rateLimitByUser } from '@/lib/api-rate-limit';

export async function GET(request: Request) {
  try {
    const { error, session } = await requireCampusRead();
    if (error || !session) return error;

    const scope = await getCampusScope(session);
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

    if (scope.level !== 'all') {
      const courseIds = scope.courseIds;
      if (courseIds.length === 0) {
        return NextResponse.json({
          sessions: [], total: 0, page, limit,
          summary: { totalSessions: 0, activeCount: 0, completedCount: 0, avgAttendanceRate: 0 },
        });
      }
      if (courseId) {
        if (!courseIds.includes(courseId)) {
          return NextResponse.json({
            sessions: [], total: 0, page, limit,
            summary: { totalSessions: 0, activeCount: 0, completedCount: 0, avgAttendanceRate: 0 },
          });
        }
      } else {
        where.courseId = { in: courseIds };
      }
    }

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

    // Summary stats (scoped)
    const summaryWhere = scope.level !== 'all' ? { courseId: { in: scope.courseIds } } : {};
    const totalSessions = await db.attendanceSession.count({ where: summaryWhere });
    const activeCount = await db.attendanceSession.count({ where: { ...summaryWhere, status: 'active' } });
    const completedCount = await db.attendanceSession.count({ where: { ...summaryWhere, status: 'completed' } });
    const avgAttendance = await db.attendanceSession.aggregate({
      _avg: { presentCount: true, expectedCount: true },
      where: { ...summaryWhere, status: 'completed' },
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
    const { error, session } = await requireRoles(STAFF_ROLES);
    if (error || !session) return error;

    const limited = await rateLimitByUser(request, session.user.id, 'attendance-sessions', 20, 60_000);
    if (limited) return limited;

    const body = await request.json();
    const { courseId, sessionDate, startTime, endTime, captureMethod, geofenceId, timetableSlotId, expectedCount } = body;

    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required' }, { status: 400 });
    }

    const scopeError = await assertCourseInScope(session, courseId);
    if (scopeError) return scopeError;

    const attendanceSession = await db.attendanceSession.create({
      data: {
        courseId,
        createdBy: session.user.id,
        sessionDate, startTime, endTime,
        captureMethod: captureMethod || 'manual',
        geofenceId, timetableSlotId,
        expectedCount: expectedCount || 0,
        status: 'active',
      },
      include: { course: { select: { name: true, code: true } } },
    });

    return NextResponse.json(attendanceSession, { status: 201 });
  } catch (error) {
    console.error('Create session error:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}
