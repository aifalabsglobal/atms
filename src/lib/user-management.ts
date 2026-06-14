import type { Role } from '@/lib/store';
import { ADMIN_ROLES } from '@/lib/auth-helpers';

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

export function canAssignRole(actorRole: Role, targetRole: Role): boolean {
  if (actorRole === 'super_admin') return true;
  if (actorRole === 'admin') return targetRole !== 'super_admin';
  if (actorRole === 'hod') {
    return ['faculty', 'lab_assistant', 'student'].includes(targetRole);
  }
  return false;
}

export function canManageUsers(actorRole: Role): boolean {
  return ADMIN_ROLES.includes(actorRole) || actorRole === 'hod';
}

export function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
