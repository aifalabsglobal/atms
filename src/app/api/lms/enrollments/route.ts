import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { ADMIN_ROLES, getCampusScope } from '@/lib/auth-helpers';
import type { Role } from '@/lib/store';
import { requireLmsRead, requireLmsWrite, assertInstructorOwnsCourse, auditLms } from '@/lib/lms-helpers';
import { rateLimitByUser } from '@/lib/api-rate-limit';

export async function GET(request: Request) {
  try {
    const { error, session } = await requireLmsRead();
    if (error || !session) return error;

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required' }, { status: 400 });
    }

    const scopeErr = await assertInstructorOwnsCourse(session, courseId);
    if (scopeErr) return scopeErr;

    const role = session.user.role as Role;
    if (role === 'student') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const course = await db.course.findUnique({
      where: { id: courseId },
      select: {
        id: true, code: true, name: true, semester: true,
        instructor: { select: { name: true } },
        program: { select: { name: true, code: true } },
        _count: { select: { enrollments: true } },
      },
    });
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    const enrollments = await db.courseEnrollment.findMany({
      where: { courseId, status: 'enrolled' },
      include: {
        student: {
          select: {
            id: true, name: true, email: true, employeeId: true,
            department: true, phone: true, status: true,
          },
        },
      },
      orderBy: { student: { name: 'asc' } },
    });

    return NextResponse.json({
      course,
      roster: enrollments.map((e) => ({
        enrollmentId: e.id,
        enrolledAt: e.enrolledAt,
        status: e.status,
        student: e.student,
      })),
      total: enrollments.length,
    });
  } catch (err) {
    console.error('Roster GET error:', err);
    return NextResponse.json({ error: 'Failed to load roster' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { error, session } = await requireLmsWrite();
    if (error || !session) return error;

    const limited = await rateLimitByUser(request, session.user.id, 'enrollments', 30, 60_000);
    if (limited) return limited;

    const body = await request.json();
    const { courseId, studentIds, studentId } = body;

    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required' }, { status: 400 });
    }

    const scopeErr = await assertInstructorOwnsCourse(session, courseId);
    if (scopeErr) return scopeErr;

    const role = session.user.role as Role;
    if (!ADMIN_ROLES.includes(role) && role !== 'hod' && role !== 'faculty' && role !== 'lab_assistant') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const ids: string[] = studentIds?.length ? studentIds : studentId ? [studentId] : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: 'studentId or studentIds required' }, { status: 400 });
    }

    const course = await db.course.findUnique({ where: { id: courseId } });
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    const students = await db.user.findMany({
      where: { id: { in: ids }, role: 'student', status: 'active' },
      select: { id: true },
    });
    if (students.length !== ids.length) {
      return NextResponse.json({ error: 'One or more invalid student IDs' }, { status: 400 });
    }

    const results = await Promise.all(
      ids.map((sid) =>
        db.courseEnrollment.upsert({
          where: { courseId_studentId: { courseId, studentId: sid } },
          create: { courseId, studentId: sid, status: 'enrolled' },
          update: { status: 'enrolled' },
        })
      )
    );

    await auditLms(request, session.user.id, 'lms.roster.add', `course:${courseId}`, { count: results.length });

    return NextResponse.json({ enrollments: results }, { status: 201 });
  } catch (err) {
    console.error('Enrollment error:', err);
    return NextResponse.json({ error: 'Failed to enroll students' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { error, session } = await requireLmsWrite();
    if (error || !session) return error;

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const studentId = searchParams.get('studentId');

    if (!courseId || !studentId) {
      return NextResponse.json({ error: 'courseId and studentId are required' }, { status: 400 });
    }

    const scopeErr = await assertInstructorOwnsCourse(session, courseId);
    if (scopeErr) return scopeErr;

    const existing = await db.courseEnrollment.findUnique({
      where: { courseId_studentId: { courseId, studentId } },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Student not on roster' }, { status: 404 });
    }

    await db.courseEnrollment.update({
      where: { courseId_studentId: { courseId, studentId } },
      data: { status: 'dropped' },
    });

    await auditLms(request, session.user.id, 'lms.roster.remove', `course:${courseId}`, { studentId });

    return NextResponse.json({ message: 'Student removed from roster' });
  } catch (err) {
    console.error('Roster DELETE error:', err);
    return NextResponse.json({ error: 'Failed to remove from roster' }, { status: 500 });
  }
}
