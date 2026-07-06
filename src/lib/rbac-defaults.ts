import type { Role, Section } from '@/lib/roles';

/** Default navigation permissions — used when no DB config exists or after reset. */
export const DEFAULT_ROLE_SECTIONS: Record<Role, Section[]> = {
  super_admin: ['dashboard', 'masters', 'attendance', 'lms', 'users', 'violations', 'reports', 'geofences', 'calendar', 'settings'],
  admin: ['dashboard', 'masters', 'attendance', 'lms', 'users', 'violations', 'reports', 'geofences', 'calendar', 'settings'],
  hod: ['dashboard', 'masters', 'attendance', 'lms', 'users', 'violations', 'reports', 'geofences', 'calendar'],
  faculty: ['dashboard', 'attendance', 'lms', 'violations', 'reports', 'geofences', 'calendar'],
  lab_assistant: ['dashboard', 'attendance', 'geofences', 'calendar'],
  student: ['dashboard', 'attendance', 'lms', 'reports', 'geofences', 'calendar'],
  parent: ['dashboard', 'attendance', 'lms', 'reports', 'calendar'],
  visitor: ['dashboard', 'geofences', 'calendar'],
  security: ['dashboard', 'attendance', 'violations', 'geofences', 'calendar'],
};

export const ALL_ROLES: Role[] = [
  'super_admin', 'admin', 'hod', 'faculty', 'lab_assistant', 'student', 'parent', 'visitor', 'security',
];

export const ALL_SECTIONS: Section[] = [
  'dashboard', 'masters', 'attendance', 'lms', 'users', 'violations', 'reports', 'geofences', 'calendar', 'settings',
];

const VALID_SECTIONS = new Set<string>(ALL_SECTIONS);
const VALID_ROLES = new Set<string>(ALL_ROLES);

export function cloneDefaultMatrix(): Record<Role, Section[]> {
  return Object.fromEntries(
    ALL_ROLES.map((role) => [role, [...DEFAULT_ROLE_SECTIONS[role]]]),
  ) as Record<Role, Section[]>;
}

/** Super admin must retain settings + dashboard so RBAC stays manageable. */
export function applyRbacGuards(matrix: Record<Role, Section[]>): Record<Role, Section[]> {
  const next = cloneDefaultMatrix();
  for (const role of ALL_ROLES) {
    const sections = matrix[role] ?? [];
    const unique = [...new Set(sections.filter((s) => VALID_SECTIONS.has(s)))] as Section[];
    if (!unique.includes('dashboard')) unique.unshift('dashboard');
    if (role === 'super_admin') {
      if (!unique.includes('settings')) unique.push('settings');
    }
    next[role] = unique;
  }
  return next;
}

export function parseRbacMatrix(raw: unknown): Record<Role, Section[]> {
  if (!raw || typeof raw !== 'object') {
    return cloneDefaultMatrix();
  }
  const input = raw as Record<string, unknown>;
  const matrix = cloneDefaultMatrix();
  for (const role of ALL_ROLES) {
    const sections = input[role];
    if (Array.isArray(sections)) {
      matrix[role] = sections.filter(
        (s): s is Section => typeof s === 'string' && VALID_SECTIONS.has(s),
      );
    }
  }
  return applyRbacGuards(matrix);
}

export function validateRbacMatrix(raw: unknown): { matrix: Record<Role, Section[]> } | { error: string } {
  if (!raw || typeof raw !== 'object') {
    return { error: 'matrix must be an object keyed by role' };
  }
  const input = raw as Record<string, unknown>;
  for (const key of Object.keys(input)) {
    if (!VALID_ROLES.has(key)) {
      return { error: `Unknown role: ${key}` };
    }
    if (!Array.isArray(input[key])) {
      return { error: `Sections for ${key} must be an array` };
    }
    for (const section of input[key] as unknown[]) {
      if (typeof section !== 'string' || !VALID_SECTIONS.has(section)) {
        return { error: `Invalid section "${String(section)}" for role ${key}` };
      }
    }
  }
  return { matrix: applyRbacGuards(parseRbacMatrix(input)) };
}

export function canAccessSectionSync(
  role: Role,
  section: Section,
  matrix?: Record<Role, Section[]> | null,
  override?: UserRbacOverrideInput | null,
): boolean {
  if (override) {
    return resolveEffectiveSections(role, matrix ?? DEFAULT_ROLE_SECTIONS, override).includes(section);
  }
  const source = matrix ?? DEFAULT_ROLE_SECTIONS;
  return source[role]?.includes(section) ?? false;
}

export type UserRbacOverrideInput = { grant: Section[]; revoke: Section[] };

export function parseUserOverride(raw: unknown): UserRbacOverrideInput {
  const empty = { grant: [] as Section[], revoke: [] as Section[] };
  if (!raw || typeof raw !== 'object') return empty;
  const input = raw as { grant?: unknown; revoke?: unknown };
  const grant = Array.isArray(input.grant)
    ? input.grant.filter((s): s is Section => typeof s === 'string' && VALID_SECTIONS.has(s))
    : [];
  const revoke = Array.isArray(input.revoke)
    ? input.revoke.filter((s): s is Section => typeof s === 'string' && VALID_SECTIONS.has(s))
    : [];
  return { grant, revoke };
}

export function validateUserOverride(raw: unknown): { override: UserRbacOverrideInput } | { error: string } {
  if (!raw || typeof raw !== 'object') {
    return { error: 'override must be an object with grant and revoke arrays' };
  }
  const input = raw as { grant?: unknown; revoke?: unknown };
  if (!Array.isArray(input.grant) || !Array.isArray(input.revoke)) {
    return { error: 'grant and revoke must be arrays' };
  }
  for (const section of [...input.grant, ...input.revoke] as unknown[]) {
    if (typeof section !== 'string' || !VALID_SECTIONS.has(section)) {
      return { error: `Invalid section "${String(section)}"` };
    }
  }
  return { override: parseUserOverride(input) };
}

/** Effective sections = role matrix + user grants − user revokes (with super_admin guards). */
export function resolveEffectiveSections(
  role: Role,
  matrix: Record<Role, Section[]>,
  override?: UserRbacOverrideInput | null,
): Section[] {
  const base = [...(matrix[role] ?? DEFAULT_ROLE_SECTIONS[role] ?? ['dashboard'] as Section[])];
  if (!override || (override.grant.length === 0 && override.revoke.length === 0)) {
    return base;
  }
  const effective = new Set<Section>(base);
  for (const s of override.grant) effective.add(s);
  for (const s of override.revoke) effective.delete(s);
  const result = [...effective];
  if (!result.includes('dashboard')) result.unshift('dashboard');
  if (role === 'super_admin') {
    if (!result.includes('settings')) result.push('settings');
  }
  return result;
}

export function computeOverrideFromEffective(
  roleSections: Section[],
  effectiveSections: Section[],
): UserRbacOverrideInput {
  const roleSet = new Set(roleSections);
  const effSet = new Set(effectiveSections);
  return {
    grant: effectiveSections.filter((s) => !roleSet.has(s)),
    revoke: roleSections.filter((s) => !effSet.has(s)),
  };
}

export function isOverrideEmpty(override: UserRbacOverrideInput): boolean {
  return override.grant.length === 0 && override.revoke.length === 0;
}
