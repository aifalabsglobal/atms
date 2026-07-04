import { NextResponse } from 'next/server';
import { requireAuth, requireSection, getCampusScope, assertCourseInScope } from '@/lib/auth-helpers';
import type { Role } from '@/lib/store';
import { logAudit, getClientIp } from '@/lib/audit';

export async function requireLmsRead(session?: { user: { id: string; role: string } } | null) {
  if (!session) {
    const { error, session: s } = await requireAuth();
    if (error || !s) return { error, session: null };
    session = s;
  }
  const role = session.user.role as Role;
  if (role === 'student' || role === 'parent') return { error: null, session };
  const { error } = await requireSection('lms');
  if (error) return { error, session: null };
  return { error: null, session };
}

export async function requireLmsWrite() {
  const { error, session } = await requireAuth();
  if (error || !session) return { error, session: null };
  const role = session.user.role as Role;
  if (role === 'hod') {
    return {
      error: NextResponse.json({ error: 'HOD has read-only LMS access' }, { status: 403 }),
      session: null,
    };
  }
  if (!['super_admin', 'admin', 'faculty', 'lab_assistant'].includes(role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), session: null };
  }
  const { error: sectionError } = await requireSection('lms');
  if (sectionError) return { error: sectionError, session: null };
  return { error: null, session };
}

export async function assertInstructorOwnsCourse(
  session: { user: { id: string; role: string } },
  courseId: string
): Promise<NextResponse | null> {
  const role = session.user.role as Role;
  if (role === 'super_admin' || role === 'admin') return null;
  const scope = await getCampusScope(session);
  if (scope.level === 'all') return null;
  return assertCourseInScope(session, courseId);
}

export async function auditLms(
  request: Request,
  userId: string,
  action: string,
  resource: string,
  details?: Record<string, unknown>
) {
  await logAudit({
    userId,
    action,
    resource,
    details,
    ipAddress: getClientIp(request),
  });
}
