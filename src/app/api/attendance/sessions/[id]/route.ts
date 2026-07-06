import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireStaffSection, assertCourseInScope } from '@/lib/auth-helpers';
import { logAudit, getClientIp } from '@/lib/audit';
import { enqueueAnchor } from '@/lib/knuct/anchor-service';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { error, session } = await requireStaffSection('attendance');
    if (error || !session) return error;

    const { id } = await context.params;
    const existing = await db.attendanceSession.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, code: true, name: true } },
        creator: { select: { name: true } },
        geofence: { select: { name: true } },
        records: {
          include: {
            student: { select: { id: true, name: true, email: true, employeeId: true } },
          },
          orderBy: { markedAt: 'desc' },
        },
        _count: { select: { records: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const scopeError = await assertCourseInScope(session, existing.courseId);
    if (scopeError) return scopeError;

    const enrollments = await db.courseEnrollment.findMany({
      where: { courseId: existing.courseId, status: 'enrolled' },
      include: { student: { select: { id: true, name: true, email: true, employeeId: true } } },
    });

    const markedIds = new Set(existing.records.map((r) => r.studentId));
    const unmarked = enrollments
      .filter((e) => !markedIds.has(e.studentId))
      .map((e) => e.student);

    return NextResponse.json({ session: existing, unmarkedStudents: unmarked });
  } catch (err) {
    console.error('Get session error:', err);
    return NextResponse.json({ error: 'Failed to load session' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { error, session } = await requireStaffSection('attendance');
    if (error || !session) return error;

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const action = body.action as string | undefined;

    if (action === 'mark') {
      const { studentId, status } = body as { studentId?: string; status?: string };
      if (!studentId || !status) {
        return NextResponse.json({ error: 'studentId and status are required' }, { status: 400 });
      }
      if (!['present', 'absent', 'late'].includes(status)) {
        return NextResponse.json({ error: 'status must be present, absent, or late' }, { status: 400 });
      }

      const existing = await db.attendanceSession.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      const scopeError = await assertCourseInScope(session, existing.courseId);
      if (scopeError) return scopeError;
      if (existing.status !== 'active') {
        return NextResponse.json({ error: 'Session is not active' }, { status: 400 });
      }

      const enrollment = await db.courseEnrollment.findFirst({
        where: { studentId, courseId: existing.courseId, status: 'enrolled' },
      });
      if (!enrollment) {
        return NextResponse.json({ error: 'Student not enrolled in this course' }, { status: 403 });
      }

      const record = await db.attendanceRecord.upsert({
        where: { sessionId_studentId: { sessionId: id, studentId } },
        create: {
          sessionId: id,
          studentId,
          status,
          markedAt: new Date(),
          captureMethod: 'manual',
        },
        update: {
          status,
          markedAt: new Date(),
          captureMethod: 'manual',
        },
      });

      const records = await db.attendanceRecord.groupBy({
        by: ['status'],
        where: { sessionId: id },
        _count: true,
      });
      const counts = Object.fromEntries(records.map((r) => [r.status, r._count]));
      const presentCount = counts.present ?? 0;
      const absentCount = counts.absent ?? 0;
      const lateCount = counts.late ?? 0;

      await db.attendanceSession.update({
        where: { id },
        data: {
          presentCount,
          absentCount: absentCount + lateCount,
          expectedCount: existing.expectedCount || presentCount + absentCount + lateCount,
        },
      });

      return NextResponse.json({ record, presentCount, absentCount: absentCount + lateCount });
    }

    if (action !== 'complete') {
      return NextResponse.json({ error: 'action must be "complete" or "mark"' }, { status: 400 });
    }

    const existing = await db.attendanceSession.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, code: true, name: true } },
        _count: { select: { records: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const scopeError = await assertCourseInScope(session, existing.courseId);
    if (scopeError) return scopeError;

    if (existing.status !== 'active') {
      return NextResponse.json({ error: 'Session is not active' }, { status: 400 });
    }

    const records = await db.attendanceRecord.groupBy({
      by: ['status'],
      where: { sessionId: id },
      _count: true,
    });

    const counts = Object.fromEntries(records.map((r) => [r.status, r._count]));
    const presentCount = counts.present ?? 0;
    const absentCount = counts.absent ?? 0;
    const lateCount = counts.late ?? 0;

    const updated = await db.attendanceSession.update({
      where: { id },
      data: {
        status: 'completed',
        presentCount,
        absentCount: absentCount + lateCount,
        expectedCount: existing.expectedCount || presentCount + absentCount + lateCount,
      },
      include: {
        course: { select: { name: true, code: true } },
        _count: { select: { records: true } },
      },
    });

    enqueueAnchor('attendance_session', id, {
      courseId: existing.courseId,
      courseCode: existing.course.code,
      sessionDate: existing.sessionDate,
      presentCount,
      absentCount: absentCount + lateCount,
      recordCount: updated._count.records,
      completedBy: session.user.id,
      completedAt: new Date().toISOString(),
    });

    await logAudit({
      userId: session.user.id,
      action: 'session.complete',
      resource: `session:${id}`,
      details: { presentCount, absentCount: absentCount + lateCount },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('Session PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
}
