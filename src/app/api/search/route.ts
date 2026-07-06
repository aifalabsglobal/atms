import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import {
  requireAuth,
  getCampusScope,
  canAccessSection,
} from '@/lib/auth-helpers';
import type { Role } from '@/lib/store';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/audit';

export async function GET(request: Request) {
  try {
    const limited = await enforceRateLimit(`search:${getClientIp(request) ?? 'anon'}`, 40, 60_000);
    if (limited) return limited;

    const { error, session } = await requireAuth();
    if (error || !session) return error;

    const role = session.user.role as Role;
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();

    if (q.length < 2) {
      return NextResponse.json({ users: [], courses: [], sessions: [], query: q });
    }

    const scope = await getCampusScope(session);
    const results: {
      users: { id: string; name: string; email: string; role: string; department: string | null }[];
      courses: { id: string; name: string; code: string }[];
      sessions: { id: string; sessionDate: string; course: { name: string; code: string } }[];
    } = { users: [], courses: [], sessions: [] };

    if ((await canAccessSection(role, 'users', session.user.id))) {
      const userWhere: Record<string, unknown> = {
        OR: [
          { name: { contains: q } },
          { email: { contains: q } },
          { employeeId: { contains: q } },
        ],
      };
      if (scope.level === 'department') {
        userWhere.departmentId = scope.departmentId;
      }
      results.users = await db.user.findMany({
        where: userWhere,
        select: { id: true, name: true, email: true, role: true, department: true },
        take: 8,
        orderBy: { name: 'asc' },
      });
    }

    if (await canAccessSection(role, 'lms', session.user.id)) {
      const courseWhere: Record<string, unknown> = {
        isActive: true,
        OR: [
          { name: { contains: q } },
          { code: { contains: q } },
        ],
      };
      if (scope.level === 'instructor') {
        courseWhere.id = { in: scope.courseIds.length ? scope.courseIds : ['__none__'] };
      } else if (scope.level === 'department') {
        courseWhere.program = { departmentId: scope.departmentId };
      } else if (role === 'student') {
        const enrollments = await db.courseEnrollment.findMany({
          where: { studentId: session.user.id, status: 'enrolled' },
          select: { courseId: true },
        });
        courseWhere.id = { in: enrollments.map((e) => e.courseId) };
      } else if (role === 'parent' && session.user.linkedStudentId) {
        const enrollments = await db.courseEnrollment.findMany({
          where: { studentId: session.user.linkedStudentId, status: 'enrolled' },
          select: { courseId: true },
        });
        courseWhere.id = { in: enrollments.map((e) => e.courseId) };
      }

      results.courses = await db.course.findMany({
        where: courseWhere,
        select: { id: true, name: true, code: true },
        take: 8,
        orderBy: { code: 'asc' },
      });
    }

    if (await canAccessSection(role, 'attendance', session.user.id)) {
      const sessionWhere: Record<string, unknown> = {
        OR: [
          { sessionDate: { contains: q } },
          { course: { name: { contains: q } } },
          { course: { code: { contains: q } } },
        ],
      };
      if (scope.level === 'instructor') {
        sessionWhere.courseId = { in: scope.courseIds.length ? scope.courseIds : ['__none__'] };
      } else if (scope.level === 'department') {
        const deptCourses = await db.course.findMany({
          where: { program: { departmentId: scope.departmentId } },
          select: { id: true },
        });
        sessionWhere.courseId = { in: deptCourses.map((c) => c.id) };
      } else if (role === 'student') {
        const enrollments = await db.courseEnrollment.findMany({
          where: { studentId: session.user.id, status: 'enrolled' },
          select: { courseId: true },
        });
        sessionWhere.courseId = { in: enrollments.map((e) => e.courseId) };
      }

      const sessions = await db.attendanceSession.findMany({
        where: sessionWhere,
        select: {
          id: true,
          sessionDate: true,
          course: { select: { name: true, code: true } },
        },
        take: 8,
        orderBy: { sessionDate: 'desc' },
      });
      results.sessions = sessions;
    }

    return NextResponse.json({ ...results, query: q });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
