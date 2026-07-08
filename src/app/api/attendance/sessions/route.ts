import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireSection, getCampusScope, assertCourseInScope, requireStaffSection } from '@/lib/auth-helpers';
import { rateLimitByUser } from '@/lib/api-rate-limit';
import { assertSessionGeofenceAssignment } from '@/lib/geofence-session';
import {
  assertTimetableSlotInScope,
  parseSessionDate,
  parseTimeValue,
  toValidationResponse,
  validateSessionTimetableLink,
} from '@/lib/timetable-helpers';
import { logAudit, getClientIp } from '@/lib/audit';

export async function GET(request: Request) {
  try {
    const { error, session } = await requireSection('attendance');
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
    const { error, session } = await requireStaffSection('attendance');
    if (error || !session) return error;

    const limited = await rateLimitByUser(request, session.user.id, 'attendance-sessions', 20, 60_000);
    if (limited) return limited;

    const body = await request.json();
    const { courseId, sessionDate, startTime, endTime, captureMethod, geofenceId, timetableSlotId, expectedCount } = body;

    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required' }, { status: 400 });
    }

    const dateErr = parseSessionDate(sessionDate);
    if (dateErr) return toValidationResponse(dateErr);

    const startErr = parseTimeValue(startTime, 'startTime');
    if (startErr) return toValidationResponse(startErr);
    if (endTime) {
      const endErr = parseTimeValue(endTime, 'endTime');
      if (endErr) return toValidationResponse(endErr);
    }

    const scopeError = await assertCourseInScope(session, courseId);
    if (scopeError) return scopeError;

    if (timetableSlotId) {
      const { error: slotScopeError } = await assertTimetableSlotInScope(session, timetableSlotId);
      if (slotScopeError) return slotScopeError;

      const linkError = await validateSessionTimetableLink(
        courseId,
        sessionDate,
        timetableSlotId,
        startTime,
        endTime,
      );
      if (linkError) return toValidationResponse(linkError);
    }

    let buildingHint: string | null = null;
    if (timetableSlotId) {
      const slot = await db.timetableSlot.findUnique({
        where: { id: timetableSlotId },
        select: { building: true },
      });
      buildingHint = slot?.building ?? null;
    }

    const { geofenceId: resolvedGeofenceId, error: geofenceError } = await assertSessionGeofenceAssignment(
      captureMethod || 'manual',
      geofenceId,
      buildingHint,
    );
    if (geofenceError) return geofenceError;

    let resolvedExpected = expectedCount || 0;
    if (timetableSlotId && !resolvedExpected) {
      const enrollCount = await db.courseEnrollment.count({ where: { courseId, status: 'enrolled' } });
      resolvedExpected = enrollCount;
    }

    let attendanceSession;
    try {
      attendanceSession = await db.$transaction(async (tx) => {
        if (timetableSlotId) {
          const duplicate = await tx.attendanceSession.findFirst({
            where: { timetableSlotId, sessionDate, status: 'active' },
          });
          if (duplicate) {
            throw Object.assign(new Error('DUPLICATE_ACTIVE_SLOT'), { status: 409 });
          }
        }

        return tx.attendanceSession.create({
          data: {
            courseId,
            createdBy: session.user.id,
            sessionDate,
            startTime,
            endTime,
            captureMethod: captureMethod || 'manual',
            geofenceId: resolvedGeofenceId,
            timetableSlotId: timetableSlotId || null,
            expectedCount: resolvedExpected,
            status: 'active',
          },
          include: {
            course: { select: { name: true, code: true } },
            timetableSlot: { select: { roomNumber: true, building: true, startTime: true, endTime: true } },
          },
        });
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message === 'DUPLICATE_ACTIVE_SLOT') {
        return NextResponse.json(
          { error: 'An active session already exists for this timetable slot on this date' },
          { status: 409 },
        );
      }
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002') {
        return NextResponse.json(
          { error: 'An active session already exists for this timetable slot on this date' },
          { status: 409 },
        );
      }
      throw err;
    }

    await logAudit({
      userId: session.user.id,
      action: 'session.create',
      resource: `session:${attendanceSession.id}`,
      details: {
        courseId,
        sessionDate,
        captureMethod: captureMethod || 'manual',
        timetableSlotId: timetableSlotId || null,
      },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json(attendanceSession, { status: 201 });
  } catch (error) {
    console.error('Create session error:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}
