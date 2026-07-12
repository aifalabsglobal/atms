import type { Role } from '@/lib/roles';

/** Roles that may open / list condonation (not lab, security, visitor). */
export const CONDONATION_VIEW_ROLES: Role[] = [
  'super_admin',
  'admin',
  'hod',
  'faculty',
  'student',
  'parent',
];

/** Staff who list pending queues (not students/parents). */
export const CONDONATION_STAFF_VIEW_ROLES: Role[] = [
  'super_admin',
  'admin',
  'hod',
  'faculty',
];

/** Always allowed to decide when in scope (HOD still dept-scoped in service). */
export const CONDONATION_DECIDE_ROLES_ALWAYS: Role[] = [
  'super_admin',
  'admin',
  'hod',
];

export function canViewCondonation(role: Role): boolean {
  return CONDONATION_VIEW_ROLES.includes(role);
}

export function canSubmitCondonation(role: Role): boolean {
  return role === 'student';
}

export function canStaffViewCondonation(role: Role): boolean {
  return CONDONATION_STAFF_VIEW_ROLES.includes(role);
}

/**
 * Coarse decide check. Service still enforces department / HOD gate / course scope.
 * Faculty may decide only when requireHodForCondonation is false.
 */
export function canDecideCondonationRole(
  role: Role,
  requireHodForCondonation: boolean,
): boolean {
  if (CONDONATION_DECIDE_ROLES_ALWAYS.includes(role)) return true;
  if (role === 'faculty' && !requireHodForCondonation) return true;
  return false;
}

export type CondonationRoleCopy = {
  title: string;
  job: string;
  next: string;
};

export function condonationRoleCopy(role: Role): CondonationRoleCopy {
  switch (role) {
    case 'student':
      return {
        title: 'Your role: Student — Request condonation',
        job: 'Submit a request if you are in the watch band; withdraw if you made a mistake.',
        next: 'After submit, wait for HOD or Admin. You will be notified; approved = Cleared for term.',
      };
    case 'parent':
      return {
        title: 'Your role: Parent — View ward condonation',
        job: 'Monitor your ward’s request and clearance. You cannot submit or decide.',
        next: 'If pending, wait for HOD/Admin. Cleared means the campus accepted the shortfall for this term.',
      };
    case 'faculty':
      return {
        title: 'Your role: Faculty — View only',
        job: 'See pending requests for students in your courses. You do not decide when HOD gate is on.',
        next: 'HOD (department) or Admin decides. Contact HOD if a student needs review.',
      };
    case 'hod':
      return {
        title: 'Your role: HOD — Decide (department)',
        job: 'Approve or reject pending condonation for students in your department.',
        next: 'Approve clears the student for the term (raw % unchanged). Reject with notes.',
      };
    case 'admin':
    case 'super_admin':
      return {
        title: 'Your role: Admin — Decide (campus)',
        job: 'Approve or reject any pending request, including students with no department.',
        next: 'Approve clears the student for the term. Use when HOD is unavailable or for null-department cases.',
      };
    default:
      return {
        title: 'Condonation',
        job: 'You are not part of the condonation process.',
        next: 'Contact your HOD or Admin if you need assistance.',
      };
  }
}
