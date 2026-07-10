import type { Role, Section } from '@/lib/roles';
import {
  applyRbacGuards,
  cloneDefaultMatrix,
  parseRbacMatrix,
} from '@/lib/rbac-defaults';
import { getSetting, setSetting, settingsCacheInvalidate } from '@/lib/settings';
import { db } from '@/lib/db';

export async function loadRbacMatrixViaSettings(): Promise<Record<Role, Section[]>> {
  try {
    const raw = await getSetting('rbac.matrix');
    if (raw && typeof raw === 'object') {
      return parseRbacMatrix(raw);
    }
  } catch {
    /* fall through */
  }
  try {
    const row = await db.rbacConfig.findUnique({ where: { id: 'default' } });
    if (row) return parseRbacMatrix(row.matrix);
  } catch {
    /* ignore */
  }
  return cloneDefaultMatrix();
}

export async function saveRbacMatrixViaSettings(
  matrix: Record<Role, Section[]>,
  updatedBy: string,
): Promise<Record<Role, Section[]>> {
  const guarded = applyRbacGuards(matrix);
  await setSetting('rbac.matrix', guarded, { updatedBy, reason: 'rbac_matrix_save' });

  // Dual-write legacy
  await db.rbacConfig.upsert({
    where: { id: 'default' },
    create: { id: 'default', matrix: guarded, updatedBy },
    update: { matrix: guarded, updatedBy },
  });

  settingsCacheInvalidate('eff:rbac.matrix');
  return guarded;
}
