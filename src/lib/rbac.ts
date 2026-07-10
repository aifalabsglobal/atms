import { db } from '@/lib/db';
import type { Role, Section } from '@/lib/roles';
import {
  applyRbacGuards,
  cloneDefaultMatrix,
  parseRbacMatrix,
  validateRbacMatrix,
  canAccessSectionSync,
  DEFAULT_ROLE_SECTIONS,
  ALL_ROLES,
  ALL_SECTIONS,
  parseUserOverride,
  validateUserOverride,
  resolveEffectiveSections,
  computeOverrideFromEffective,
  isOverrideEmpty,
  type UserRbacOverrideInput,
} from '@/lib/rbac-defaults';

export {
  DEFAULT_ROLE_SECTIONS,
  ALL_ROLES,
  ALL_SECTIONS,
  applyRbacGuards,
  parseRbacMatrix,
  validateRbacMatrix,
  canAccessSectionSync,
  cloneDefaultMatrix,
  parseUserOverride,
  validateUserOverride,
  resolveEffectiveSections,
  computeOverrideFromEffective,
  isOverrideEmpty,
  type UserRbacOverrideInput,
} from '@/lib/rbac-defaults';

let cachedMatrix: Record<Role, Section[]> | null = null;
let cacheTime = 0;
const CACHE_MS = 120_000;

const userOverrideCache = new Map<string, { data: UserRbacOverrideInput | null; time: number }>();

export function invalidateRbacCache() {
  cachedMatrix = null;
  cacheTime = 0;
  userOverrideCache.clear();
}

export function invalidateUserRbacCache(userId?: string) {
  if (userId) userOverrideCache.delete(userId);
  else userOverrideCache.clear();
}

export async function getRbacMatrix(): Promise<Record<Role, Section[]>> {
  if (cachedMatrix && Date.now() - cacheTime < CACHE_MS) {
    return cachedMatrix;
  }
  try {
    const row = await db.rbacConfig.findUnique({ where: { id: 'default' } });
    cachedMatrix = row ? parseRbacMatrix(row.matrix) : cloneDefaultMatrix();
  } catch {
    cachedMatrix = cloneDefaultMatrix();
  }
  cacheTime = Date.now();
  return cachedMatrix;
}

export async function saveRbacMatrix(
  matrix: Record<Role, Section[]>,
  updatedBy: string,
): Promise<Record<Role, Section[]>> {
  const guarded = applyRbacGuards(matrix);
  await db.rbacConfig.upsert({
    where: { id: 'default' },
    create: { id: 'default', matrix: guarded, updatedBy },
    update: { matrix: guarded, updatedBy },
  });
  invalidateRbacCache();
  return guarded;
}

export async function resetRbacMatrix(updatedBy: string): Promise<Record<Role, Section[]>> {
  return saveRbacMatrix(cloneDefaultMatrix(), updatedBy);
}

export async function getUserRbacOverride(userId: string): Promise<UserRbacOverrideInput | null> {
  const cached = userOverrideCache.get(userId);
  if (cached && Date.now() - cached.time < CACHE_MS) {
    return cached.data;
  }
  try {
    const row = await db.userRbacOverride.findUnique({ where: { userId } });
    const parsed = row ? parseUserOverride({ grant: row.grant, revoke: row.revoke }) : null;
    const data = parsed && !isOverrideEmpty(parsed) ? parsed : null;
    userOverrideCache.set(userId, { data, time: Date.now() });
    return data;
  } catch {
    return null;
  }
}

export async function resolveUserSections(userId: string, role: Role): Promise<Section[]> {
  const matrix = await getRbacMatrix();
  const override = await getUserRbacOverride(userId);
  return resolveEffectiveSections(role, matrix, override);
}

export async function canAccessSectionAsync(
  role: Role,
  section: Section,
  userId?: string,
): Promise<boolean> {
  if (role === 'super_admin') return ALL_SECTIONS.includes(section);
  if (!userId) {
    const matrix = await getRbacMatrix();
    return matrix[role]?.includes(section) ?? false;
  }
  const sections = await resolveUserSections(userId, role);
  return sections.includes(section);
}

export async function saveUserRbacOverride(
  userId: string,
  override: UserRbacOverrideInput,
  updatedBy: string,
): Promise<UserRbacOverrideInput | null> {
  if (isOverrideEmpty(override)) {
    await db.userRbacOverride.deleteMany({ where: { userId } });
    invalidateUserRbacCache(userId);
    return null;
  }
  await db.userRbacOverride.upsert({
    where: { userId },
    create: { userId, grant: override.grant, revoke: override.revoke, updatedBy },
    update: { grant: override.grant, revoke: override.revoke, updatedBy },
  });
  invalidateUserRbacCache(userId);
  return override;
}

export async function saveUserEffectiveSections(
  userId: string,
  role: Role,
  effectiveSections: Section[],
  updatedBy: string,
): Promise<{ override: UserRbacOverrideInput | null; effectiveSections: Section[] }> {
  const matrix = await getRbacMatrix();
  const roleSections = matrix[role] ?? DEFAULT_ROLE_SECTIONS[role] ?? [];
  const override = computeOverrideFromEffective(roleSections, effectiveSections);
  const saved = await saveUserRbacOverride(userId, override, updatedBy);
  const effective = resolveEffectiveSections(role, matrix, saved);
  return { override: saved, effectiveSections: effective };
}

export async function deleteUserRbacOverride(userId: string): Promise<void> {
  await db.userRbacOverride.deleteMany({ where: { userId } });
  invalidateUserRbacCache(userId);
}

export type UserRbacOverrideSummary = {
  userId: string;
  name: string;
  email: string;
  role: Role;
  grant: Section[];
  revoke: Section[];
  updatedAt: string;
};

export async function listUserRbacOverrides(): Promise<UserRbacOverrideSummary[]> {
  const rows = await db.userRbacOverride.findMany({
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  return rows.map((row) => {
    const parsed = parseUserOverride({ grant: row.grant, revoke: row.revoke });
    return {
      userId: row.userId,
      name: row.user.name,
      email: row.user.email,
      role: row.user.role as Role,
      grant: parsed.grant,
      revoke: parsed.revoke,
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

export async function getRbacMeta(): Promise<{ matrix: Record<Role, Section[]>; updatedAt: string | null; updatedBy: string | null }> {
  const row = await db.rbacConfig.findUnique({ where: { id: 'default' } });
  if (!row) {
    return { matrix: cloneDefaultMatrix(), updatedAt: null, updatedBy: null };
  }
  return {
    matrix: parseRbacMatrix(row.matrix),
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  };
}

export async function getUserRbacDetail(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, status: true },
  });
  if (!user) return null;

  const role = user.role as Role;
  const matrix = await getRbacMatrix();
  const override = await getUserRbacOverride(userId);
  const roleSections = matrix[role] ?? DEFAULT_ROLE_SECTIONS[role] ?? [];
  const effectiveSections = resolveEffectiveSections(role, matrix, override);

  return {
    user,
    roleSections,
    effectiveSections,
    override: override ?? { grant: [], revoke: [] },
  };
}
