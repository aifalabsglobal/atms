import { rateLimitByUser } from '@/lib/api-rate-limit';
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getCampusScope, requireSection } from '@/lib/auth-helpers';
import { logAudit, getClientIp } from '@/lib/audit';
import { enqueueAnchor } from '@/lib/knuct/anchor-service';

export async function GET(request: Request) {
  try {
    const { error, session } = await requireSection('violations');
    if (error || !session) return error;

    const scope = await getCampusScope(session);
    const { searchParams } = new URL(request.url);
    const reviewStatus = searchParams.get('reviewStatus');
    const severity = searchParams.get('severity');
    const type = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = {};
    if (reviewStatus) where.reviewStatus = reviewStatus;
    if (severity) where.severity = severity;
    if (type) where.type = type;

    if (scope.level === 'department') {
      where.violator = { departmentId: scope.departmentId };
    } else if (scope.level === 'instructor') {
      const enrollments = await db.courseEnrollment.findMany({
        where: { courseId: { in: scope.courseIds }, status: 'enrolled' },
        select: { studentId: true },
        distinct: ['studentId'],
      });
      const studentIds = enrollments.map((e) => e.studentId);
      where.studentId = { in: studentIds.length > 0 ? studentIds : ['__none__'] };
    }

    const [violations, total] = await Promise.all([
      db.attendanceViolation.findMany({
        where,
        include: {
          violator: { select: { name: true, email: true, department: true, employeeId: true } },
          reviewer: { select: { name: true } },
          record: { select: { status: true, captureMethod: true, session: { select: { sessionDate: true, course: { select: { name: true, code: true } } } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.attendanceViolation.count({ where }),
    ]);

    return NextResponse.json({ violations, total, page, limit });
  } catch (error) {
    console.error('Violations API error:', error);
    return NextResponse.json({ error: 'Failed to load violations' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { error, session } = await requireSection('violations');
    if (error || !session) return error;

    const limited = await rateLimitByUser(request, session.user.id, 'violation-review', 30, 60_000);
    if (limited) return limited;

    const body = await request.json();
    const { id, reviewStatus, reviewNotes } = body;

    const existing = await db.attendanceViolation.findUnique({
      where: { id },
      include: {
        violator: { select: { departmentId: true } },
        record: { select: { session: { select: { courseId: true } } } },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Violation not found' }, { status: 404 });
    }

    const scope = await getCampusScope(session);
    if (scope.level === 'department') {
      if (existing.violator.departmentId !== scope.departmentId) {
        return NextResponse.json({ error: 'Violation is outside your department scope' }, { status: 403 });
      }
    } else if (scope.level === 'instructor') {
      const courseId = existing.record?.session?.courseId;
      if (!courseId || !scope.courseIds.includes(courseId)) {
        return NextResponse.json({ error: 'Violation is outside your course scope' }, { status: 403 });
      }
    }

    const violation = await db.attendanceViolation.update({
      where: { id },
      data: { reviewStatus, reviewNotes, reviewedBy: session.user.id },
      include: { violator: { select: { name: true } } },
    });

    await logAudit({
      userId: session.user.id,
      action: 'violation.review',
      resource: `violation:${id}`,
      details: { reviewStatus, violator: violation.violator.name },
      ipAddress: getClientIp(request),
    });

    enqueueAnchor('violation_review', id, {
      reviewStatus,
      reviewNotes: reviewNotes ?? null,
      reviewedBy: session.user.id,
      studentId: existing.studentId,
      reviewedAt: new Date().toISOString(),
    });

    return NextResponse.json(violation);
  } catch (error) {
    console.error('Update violation error:', error);
    return NextResponse.json({ error: 'Failed to update violation' }, { status: 500 });
  }
}
