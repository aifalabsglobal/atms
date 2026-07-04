import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireLmsWrite, assertInstructorOwnsCourse } from '@/lib/lms-helpers';
import { ADMIN_ROLES } from '@/lib/auth-helpers';
import type { Role } from '@/lib/store';

/** Students eligible to add to a course roster (active, not already enrolled). */
export async function GET(request: Request) {
  try {
    const { error, session } = await requireLmsWrite();
    if (error || !session) return error;

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const search = searchParams.get('search')?.trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required' }, { status: 400 });
    }

    const scopeErr = await assertInstructorOwnsCourse(session, courseId);
    if (scopeErr) return scopeErr;

    const course = await db.course.findUnique({
      where: { id: courseId },
      include: { program: { select: { departmentId: true } } },
    });
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    const enrolled = await db.courseEnrollment.findMany({
      where: { courseId, status: 'enrolled' },
      select: { studentId: true },
    });
    const enrolledIds = enrolled.map((e) => e.studentId);
    const role = session.user.role as Role;
    const campusWide = ADMIN_ROLES.includes(role) || searchParams.get('campusWide') === 'true';

    const where: Record<string, unknown> = {
      role: 'student',
      status: 'active',
      id: { notIn: enrolledIds.length ? enrolledIds : ['__none__'] },
    };

    if (!campusWide) {
      where.departmentId = course.program.departmentId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { employeeId: { contains: search } },
      ];
    }

    const candidates = await db.user.findMany({
      where,
      select: { id: true, name: true, email: true, employeeId: true, department: true },
      orderBy: { name: 'asc' },
      take: limit,
    });

    return NextResponse.json({ candidates, total: candidates.length });
  } catch (err) {
    console.error('Roster candidates error:', err);
    return NextResponse.json({ error: 'Failed to load candidates' }, { status: 500 });
  }
}
