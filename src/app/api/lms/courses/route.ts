import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAuth, resolveStudentId, getCampusScope, requireSection } from '@/lib/auth-helpers';
import type { Role } from '@/lib/store';

export async function GET(request: Request) {
  try {
    const { error, session } = await requireAuth();
    if (error || !session) return error;

    const role = session.user.role as Role;
    if (role === 'student' || role === 'parent') {
      // student/parent see enrolled courses only — allowed without lms nav section check
    } else {
      const { error: sectionError } = await requireSection('lms');
      if (sectionError) return sectionError;
    }

    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('programId');
    const type = searchParams.get('type');
    const instructorId = searchParams.get('instructorId');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = { isActive: true };
    if (programId) where.programId = programId;
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
      ];
    }

    if (role === 'student' || role === 'parent') {
      const { studentId, error: studentError } = await resolveStudentId(session, searchParams.get('studentId'));
      if (studentError) return studentError;
      if (!studentId) {
        return NextResponse.json({ courses: [], total: 0, page, limit });
      }
      const enrollments = await db.courseEnrollment.findMany({
        where: { studentId, status: 'enrolled' },
        select: { courseId: true },
      });
      const enrolledIds = enrollments.map((e) => e.courseId);
      where.id = { in: enrolledIds.length > 0 ? enrolledIds : ['__none__'] };
    } else if (role === 'faculty' || role === 'lab_assistant') {
      where.instructorId = instructorId || session.user.id;
    } else if (role === 'hod') {
      const scope = await getCampusScope(session);
      if (scope.level === 'department') {
        where.id = { in: scope.courseIds.length > 0 ? scope.courseIds : ['__none__'] };
      }
    } else if (instructorId) {
      where.instructorId = instructorId;
    }

    const [courses, total] = await Promise.all([
      db.course.findMany({
        where,
        include: {
          program: { select: { name: true, code: true } },
          instructor: { select: { name: true, email: true } },
          _count: { select: { enrollments: true, modules: true, assignments: true, attendanceSessions: true } },
          modules: { include: { _count: { select: { lessons: true } } }, orderBy: { orderIndex: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.course.count({ where }),
    ]);

    return NextResponse.json({ courses, total, page, limit });
  } catch (error) {
    console.error('Courses API error:', error);
    return NextResponse.json({ error: 'Failed to load courses' }, { status: 500 });
  }
}
