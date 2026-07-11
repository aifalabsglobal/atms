import { NextResponse } from 'next/server';
import { requireSection, requireWritableSection, ADMIN_ROLES } from '@/lib/auth-helpers';
import type { Role } from '@/lib/store';
import { logAudit, getClientIp } from '@/lib/audit';
import { db } from '@/lib/db';

export async function requireMastersRead() {
  return requireSection('masters');
}

/** Mutations: admin / super_admin only. HOD has read-only masters. */
export async function requireMastersWrite() {
  const { error, session } = await requireWritableSection('masters');
  if (error || !session) return { error, session: null };
  const role = session.user.role as Role;
  if (!ADMIN_ROLES.includes(role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), session: null };
  }
  return { error: null, session };
}

/** @deprecated use requireMastersRead for GET, requireMastersWrite for mutations */
export async function requireMastersAccess() {
  return requireMastersRead();
}

export async function getMastersDepartmentId(session: { user: { id: string; role: string } }): Promise<string | null> {
  const role = session.user.role as Role;
  if (role !== 'hod') return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { departmentId: true },
  });
  return user?.departmentId ?? null;
}

export async function applyMastersDepartmentScope(
  session: { user: { id: string; role: string } },
  where: Record<string, unknown>
) {
  const deptId = await getMastersDepartmentId(session);
  if (deptId) where.departmentId = deptId;
  return where;
}

/** HOD: semesters that have subjects in their department */
export async function applySemesterDepartmentScope(
  session: { user: { id: string; role: string } },
  where: Record<string, unknown>
) {
  const deptId = await getMastersDepartmentId(session);
  if (deptId) where.subjects = { some: { departmentId: deptId } };
  return where;
}

/** HOD: academic years linked to dept semesters/subjects */
export async function applyAcademicYearDepartmentScope(
  session: { user: { id: string; role: string } },
  where: Record<string, unknown>
) {
  const deptId = await getMastersDepartmentId(session);
  if (deptId) {
    where.semesters = { some: { subjects: { some: { departmentId: deptId } } } };
  }
  return where;
}

export function isMastersReadOnly(role: Role) {
  return role === 'hod';
}

export async function auditMasterMutation(
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

export async function ensureSingleActiveAcademicYear(excludeId?: string) {
  const active = await db.academicYear.findFirst({
    where: { status: 'active', ...(excludeId ? { NOT: { id: excludeId } } : {}) },
  });
  return active;
}

export function mastersError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
