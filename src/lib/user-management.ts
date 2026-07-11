import type { Role } from '@/lib/store';

export const STAFF_ROLES: Role[] = [
  'super_admin',
  'admin',
  'hod',
  'faculty',
  'lab_assistant',
  'security',
];

export const CAMPUS_USER_ROLES: Role[] = ['student', 'parent', 'visitor'];

export const ALL_ROLES: Role[] = [
  'super_admin',
  'admin',
  'hod',
  'faculty',
  'lab_assistant',
  'student',
  'parent',
  'visitor',
  'security',
];

export const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'hod', label: 'HOD' },
  { value: 'faculty', label: 'Faculty (Teacher)' },
  { value: 'lab_assistant', label: 'Lab Assistant' },
  { value: 'student', label: 'Student' },
  { value: 'parent', label: 'Parent' },
  { value: 'visitor', label: 'Visitor' },
  { value: 'security', label: 'Security' },
];

const HOD_ASSIGNABLE: Role[] = ['faculty', 'lab_assistant', 'student'];

export type RoleScope = 'all' | 'staff' | 'campus';

export function rolesForActor(
  actorRole: Role,
  scope: RoleScope = 'all',
): { value: Role; label: string }[] {
  let roles: { value: Role; label: string }[];
  if (actorRole === 'super_admin') {
    roles = [{ value: 'super_admin', label: 'Super Admin' }, ...ROLE_OPTIONS];
  } else if (actorRole === 'admin') {
    roles = [...ROLE_OPTIONS];
  } else if (actorRole === 'hod') {
    roles = ROLE_OPTIONS.filter((r) => HOD_ASSIGNABLE.includes(r.value));
  } else {
    roles = [];
  }

  if (scope === 'staff') {
    roles = roles.filter((r) => STAFF_ROLES.includes(r.value));
  } else if (scope === 'campus') {
    roles = roles.filter((r) => !STAFF_ROLES.includes(r.value));
  }
  return roles;
}

export function defaultRoleForScope(actorRole: Role, scope: RoleScope): Role {
  const roles = rolesForActor(actorRole, scope);
  if (scope === 'staff') {
    const faculty = roles.find((r) => r.value === 'faculty');
    if (faculty) return faculty.value;
  }
  if (scope === 'campus') {
    const student = roles.find((r) => r.value === 'student');
    if (student) return student.value;
  }
  return roles[0]?.value ?? 'student';
}

export function canAssignRole(actorRole: Role, targetRole: Role): boolean {
  if (actorRole === 'super_admin') return true;
  if (actorRole === 'admin') return targetRole !== 'super_admin';
  if (actorRole === 'hod') {
    return ['faculty', 'lab_assistant', 'student'].includes(targetRole);
  }
  return false;
}

const ADMIN_ROLES: Role[] = ['super_admin', 'admin'];

export function canManageUsers(actorRole: Role): boolean {
  return ADMIN_ROLES.includes(actorRole) || actorRole === 'hod';
}

export function isStaffRole(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}

export function generateTempPassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const len = Math.min(32, Math.max(8, Math.round(length) || 10));
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
