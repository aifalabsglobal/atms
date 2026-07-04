import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireRoles, STAFF_ROLES, assertCourseInScope } from '@/lib/auth-helpers';
import { logAudit, getClientIp } from '@/lib/audit';
import { enqueueAnchor } from '@/lib/knuct/anchor-service';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { error, session } = await requireRoles(STAFF_ROLES);
    if (error || !session) return error;

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const action = body.action as string | undefined;

    if (action !== 'complete') {
      return NextResponse.json({ error: 'action must be "complete"' }, { status: 400 });
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
    console.error('Complete session error:', err);
    return NextResponse.json({ error: 'Failed to complete session' }, { status: 500 });
  }
}
