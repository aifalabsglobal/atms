import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import type { Role, Section } from '@/lib/store';
import { canAccessSectionAsync } from '@/lib/rbac';
import { STAFF_ROLES, CAMPUS_USER_ROLES } from '@/lib/user-management';
import { db } from '@/lib/db';
import { assertNotInMaintenance } from '@/lib/settings/maintenance';

export { STAFF_ROLES, CAMPUS_USER_ROLES };

export async function getAuthSession() {
  return getServerSession(authOptions);
}

export async function requireAuth() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      session: null,
    };
  }
  return { error: null, session };
}

export async function requireRoles(allowedRoles: Role[]) {
  const { error, session } = await requireAuth();
  if (error || !session) return { error, session: null };

  const role = session.user.role as Role;
  if (!allowedRoles.includes(role)) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      session: null,
    };
  }
  return { error: null, session };
}

/** Like requireRoles, but blocked for non-admins while maintenance mode is on. */
export async function requireWritableRoles(allowedRoles: Role[]) {
  const result = await requireRoles(allowedRoles);
  if (result.error || !result.session) return result;
  const blocked = await assertNotInMaintenance(result.session.user.role);
  if (blocked) return { error: blocked, session: null };
  return result;
}

/** Like requireSection, but blocked for non-admins while maintenance mode is on. */
export async function requireWritableSection(section: Section) {
  const result = await requireSection(section);
  if (result.error || !result.session) return result;
  const blocked = await assertNotInMaintenance(result.session.user.role);
  if (blocked) return { error: blocked, session: null };
  return result;
}

/** Like requireAuth, but blocked for non-admins while maintenance mode is on. */
export async function requireWritableAuth() {
  const result = await requireAuth();
  if (result.error || !result.session) return result;
  const blocked = await assertNotInMaintenance(result.session.user.role);
  if (blocked) return { error: blocked, session: null };
  return result;
}


export const ADMIN_ROLES: Role[] = ['super_admin', 'admin'];
export const CAMPUS_READ_ROLES: Role[] = ['super_admin', 'admin', 'hod', 'faculty', 'lab_assistant', 'security'];

export async function canAccessSection(role: Role, section: Section, userId?: string): Promise<boolean> {
  if (role === 'super_admin') return true;
  return canAccessSectionAsync(role, section, userId);
}

/** Resolve which student record the caller may access. */
export async function resolveStudentId(
  session: { user: { id: string; role: string; linkedStudentId?: string } },
  requestedStudentId: string | null
): Promise<{ studentId: string | null; error: NextResponse | null }> {
  const role = session.user.role as Role;

  if (role === 'student') {
    if (requestedStudentId && requestedStudentId !== session.user.id) {
      return { studentId: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }
    return { studentId: session.user.id, error: null };
  }

  if (role === 'parent') {
    const wardId = session.user.linkedStudentId;
    if (!wardId) {
      return { studentId: null, error: NextResponse.json({ error: 'No linked student for parent account' }, { status: 403 }) };
    }
    if (requestedStudentId && requestedStudentId !== wardId) {
      return { studentId: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }
    return { studentId: wardId, error: null };
  }

  if (CAMPUS_READ_ROLES.includes(role)) {
    return { studentId: requestedStudentId, error: null };
  }

  // visitor and other roles cannot access student-scoped data
  if (requestedStudentId) {
    return { studentId: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { studentId: null, error: null };
}

export async function requireSection(section: Section) {
  const { error, session } = await requireAuth();
  if (error || !session) return { error, session: null };
  const role = session.user.role as Role;
  if (role === 'super_admin') return { error: null, session };
  if (!(await canAccessSection(role, section, session.user.id))) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      session: null,
    };
  }
  return { error: null, session };
}

/** Passes when the user has RBAC access to any of the given sections. */
export async function requireAnySection(sections: Section[]) {
  const { error, session } = await requireAuth();
  if (error || !session) return { error, session: null };
  const role = session.user.role as Role;
  const userId = session.user.id;
  for (const section of sections) {
    if (await canAccessSection(role, section, userId)) {
      return { error: null, session };
    }
  }
  return {
    error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    session: null,
  };
}

/** Campus-scoped list APIs (timetable, session lists, etc.). */
export async function requireCampusRead() {
  return requireAnySection(['attendance', 'masters']);
}

export async function requireUserManagement() {
  return requireSection('users');
}

/** Staff-only mutation within a section (students may have read/mark access). */
export async function requireStaffSection(section: Section) {
  const { error, session } = await requireWritableSection(section);
  if (error || !session) return { error, session: null };
  const role = session.user.role as Role;
  if (!STAFF_ROLES.includes(role)) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      session: null,
    };
  }
  return { error: null, session };
}

/** Self-mark capture methods restricted to student/parent. */
export const SELF_MARK_METHODS = ['self_geo_face', 'gps', 'face'] as const;

export async function assertCourseInScope(
  session: { user: { id: string; role: string } },
  courseId: string
): Promise<NextResponse | null> {
  const scope = await getCampusScope(session);
  if (scope.level === 'all') return null;
  if (!scope.courseIds.includes(courseId)) {
    return NextResponse.json({ error: 'Course is outside your scope' }, { status: 403 });
  }
  return null;
}

export function buildCourseIdFilter(
  scope: CampusScope,
  courseId?: string | null
): string | { in: string[] } | undefined {
  if (scope.level === 'all') return courseId ?? undefined;
  const ids = scope.courseIds.length > 0 ? scope.courseIds : ['__none__'];
  if (courseId) return scope.courseIds.includes(courseId) ? courseId : '__none__';
  return { in: ids };
}

/** Load linked student id from DB when missing from JWT (e.g. after schema migration). */
export async function getLinkedStudentId(userId: string): Promise<string | undefined> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { linkedStudentId: true },
  });
  return user?.linkedStudentId ?? undefined;
}

export type CampusScope =
  | { level: 'all' }
  | { level: 'instructor'; courseIds: string[] }
  | { level: 'department'; departmentId: string; courseIds: string[] };

/** Resolve which courses/users/sessions a staff role may see campus-wide. */
export async function getCampusScope(
  session: { user: { id: string; role: string } }
): Promise<CampusScope> {
  const role = session.user.role as Role;

  if (role === 'super_admin' || role === 'admin' || role === 'security') {
    return { level: 'all' };
  }

  if (role === 'faculty' || role === 'lab_assistant') {
    const courses = await db.course.findMany({
      where: { instructorId: session.user.id, isActive: true },
      select: { id: true },
    });
    return { level: 'instructor', courseIds: courses.map((c) => c.id) };
  }

  if (role === 'hod') {
    const hod = await db.user.findUnique({
      where: { id: session.user.id },
      select: { departmentId: true },
    });
    if (!hod?.departmentId) {
      return { level: 'department', departmentId: '', courseIds: [] };
    }
    const courses = await db.course.findMany({
      where: { program: { departmentId: hod.departmentId }, isActive: true },
      select: { id: true },
    });
    return {
      level: 'department',
      departmentId: hod.departmentId,
      courseIds: courses.map((c) => c.id),
    };
  }

  return { level: 'instructor', courseIds: [] };
}

export async function getScopedCourseIds(scope: CampusScope): Promise<string[] | null> {
  if (scope.level === 'all') return null;
  return scope.courseIds;
}
