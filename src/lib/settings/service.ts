import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import {
  getSettingDefinition,
  listSettingCategories,
  listSettingDefinitions,
  requireSettingDefinition,
  validateSettingValue,
} from './registry';
import { settingsCacheGet, settingsCacheInvalidate, settingsCacheSet } from './cache';
import { resolveEffectiveValue } from './resolve';
import type {
  EffectiveSetting,
  SettingCategory,
  SettingLayer,
  SettingScope,
  SetSettingOptions,
} from './types';
import { isDemoAuthAllowed } from '@/lib/demo-mode';

const GLOBAL_SCOPE: SettingScope = 'global';
const EMPTY_SCOPE_ID = '';

function cacheKeyEffective(key: string, userId?: string, departmentId?: string) {
  return `eff:${key}:${departmentId ?? ''}:${userId ?? ''}`;
}

function readEnvOverride(def: ReturnType<typeof requireSettingDefinition>): unknown | undefined {
  if (!def.envOnly && !def.envKey) return undefined;
  const envName = def.envKey;
  if (!envName) return undefined;

  if (def.key === 'flags.demo_auth_visible') {
    return isDemoAuthAllowed();
  }

  const raw = process.env[envName];
  if (raw === undefined || raw === '') return undefined;
  if (def.valueType === 'boolean') return raw === 'true' || raw === '1';
  if (def.valueType === 'number' || def.valueType === 'decimal') {
    const n = Number(raw);
    return Number.isNaN(n) ? undefined : n;
  }
  return raw;
}

async function loadScopedRows(key: string) {
  return db.settingValue.findMany({
    where: { key },
    orderBy: { updatedAt: 'desc' },
  });
}

function pickLayer(
  rows: Awaited<ReturnType<typeof loadScopedRows>>,
  scope: SettingScope,
  scopeId: string,
) {
  return rows.find((r) => r.scope === scope && r.scopeId === (scopeId || EMPTY_SCOPE_ID));
}

/**
 * Resolve effective value: env → user → department → organization → global → default
 */
export async function getEffectiveSetting(
  key: string,
  opts?: { userId?: string; departmentId?: string; organizationId?: string },
): Promise<EffectiveSetting> {
  const def = requireSettingDefinition(key);
  const ck = cacheKeyEffective(key, opts?.userId, opts?.departmentId);
  const cached = settingsCacheGet<EffectiveSetting>(ck);
  if (cached) return cached;

  const layers: SettingLayer[] = [];
  const envVal = readEnvOverride(def);
  if (envVal !== undefined) {
    layers.push({ scope: 'global', scopeId: 'env', value: envVal });
  }

  let rows: Awaited<ReturnType<typeof loadScopedRows>> = [];
  if (!def.envOnly) {
    try {
      rows = await loadScopedRows(key);
    } catch {
      rows = [];
    }
  }

  const pushIf = (scope: SettingScope, scopeId: string) => {
    const row = pickLayer(rows, scope, scopeId);
    if (row) {
      layers.push({
        scope,
        scopeId: row.scopeId,
        value: row.value,
        version: row.version,
        updatedBy: row.updatedBy,
        updatedAt: row.updatedAt.toISOString(),
      });
    }
  };

  if (opts?.userId) pushIf('user', opts.userId);
  if (opts?.departmentId) pushIf('department', opts.departmentId);
  if (opts?.organizationId) pushIf('organization', opts.organizationId);
  pushIf(GLOBAL_SCOPE, EMPTY_SCOPE_ID);

  layers.push({
    scope: GLOBAL_SCOPE,
    scopeId: 'default',
    value: def.defaultValue,
  });

  const resolved = resolveEffectiveValue({
    defaultValue: def.defaultValue,
    envValue: envVal,
    layers: rows.map((r) => ({
      scope: r.scope as SettingScope,
      scopeId: r.scopeId,
      value: r.value,
      version: r.version,
      updatedBy: r.updatedBy,
      updatedAt: r.updatedAt.toISOString(),
    })),
    userId: opts?.userId,
    departmentId: opts?.departmentId,
    organizationId: opts?.organizationId,
  });

  const result: EffectiveSetting = {
    key,
    definition: def,
    value: resolved.value,
    source: resolved.source,
    layers,
    version: resolved.version,
    updatedBy: resolved.updatedBy,
    updatedAt: resolved.updatedAt,
  };
  return settingsCacheSet(ck, result, 60_000);
}

export async function getSetting(
  key: string,
  opts?: { userId?: string; departmentId?: string },
): Promise<unknown> {
  const eff = await getEffectiveSetting(key, opts);
  return eff.value;
}

export async function getByCategory(
  category: SettingCategory,
  opts?: { userId?: string; departmentId?: string },
): Promise<EffectiveSetting[]> {
  const defs = listSettingDefinitions(category);
  return Promise.all(defs.map((d) => getEffectiveSetting(d.key, opts)));
}

export async function listAllSettings(opts?: {
  category?: SettingCategory;
  search?: string;
  userId?: string;
  departmentId?: string;
}): Promise<EffectiveSetting[]> {
  let defs = listSettingDefinitions(opts?.category);
  if (opts?.search?.trim()) {
    const q = opts.search.trim().toLowerCase();
    defs = defs.filter(
      (d) =>
        d.key.toLowerCase().includes(q) ||
        d.displayName.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q),
    );
  }
  return Promise.all(defs.map((d) => getEffectiveSetting(d.key, opts)));
}

export async function setSetting(
  key: string,
  value: unknown,
  options: SetSettingOptions = {},
): Promise<EffectiveSetting> {
  const def = requireSettingDefinition(key);
  const err = validateSettingValue(def, value);
  if (err) throw new Error(err);

  const scope = options.scope ?? GLOBAL_SCOPE;
  const scopeId = options.scopeId ?? EMPTY_SCOPE_ID;
  if (scope !== GLOBAL_SCOPE && !options.scopeId) {
    throw new Error('scopeId is required for non-global scopes');
  }

  const existing = await db.settingValue.findUnique({
    where: { key_scope_scopeId: { key, scope, scopeId } },
  });

  const nextVersion = (existing?.version ?? 0) + 1;
  const jsonValue = value as Prisma.InputJsonValue;

  if (!options.skipHistory && existing) {
    await db.settingHistory.create({
      data: {
        key,
        scope,
        scopeId,
        value: existing.value as Prisma.InputJsonValue,
        version: existing.version,
        updatedBy: existing.updatedBy,
        reason: options.reason ?? 'replaced',
      },
    });
  }

  await db.settingValue.upsert({
    where: { key_scope_scopeId: { key, scope, scopeId } },
    create: {
      key,
      scope,
      scopeId,
      value: jsonValue,
      version: nextVersion,
      updatedBy: options.updatedBy,
    },
    update: {
      value: jsonValue,
      version: nextVersion,
      updatedBy: options.updatedBy,
    },
  });

  if (!options.skipHistory) {
    await db.settingHistory.create({
      data: {
        key,
        scope,
        scopeId,
        value: jsonValue,
        version: nextVersion,
        updatedBy: options.updatedBy,
        reason: options.reason ?? 'set',
      },
    });
  }

  settingsCacheInvalidate(`eff:${key}`);
  settingsCacheInvalidate('list:');
  return getEffectiveSetting(key);
}

export async function resetSetting(
  key: string,
  options: SetSettingOptions = {},
): Promise<EffectiveSetting> {
  const def = requireSettingDefinition(key);
  return setSetting(key, def.defaultValue, {
    ...options,
    reason: options.reason ?? 'reset_to_default',
  });
}

export async function resetCategory(
  category: SettingCategory,
  options: SetSettingOptions = {},
): Promise<EffectiveSetting[]> {
  const defs = listSettingDefinitions(category).filter((d) => !d.envOnly && d.editable !== false);
  const results: EffectiveSetting[] = [];
  for (const d of defs) {
    results.push(await resetSetting(d.key, options));
  }
  return results;
}

export async function getSettingHistory(key: string, take = 50) {
  requireSettingDefinition(key);
  return db.settingHistory.findMany({
    where: { key, scope: GLOBAL_SCOPE, scopeId: EMPTY_SCOPE_ID },
    orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
    take,
  });
}

export async function rollbackSetting(
  key: string,
  version: number,
  options: SetSettingOptions = {},
): Promise<EffectiveSetting> {
  const row = await db.settingHistory.findFirst({
    where: { key, scope: GLOBAL_SCOPE, scopeId: EMPTY_SCOPE_ID, version },
  });
  if (!row) throw new Error(`No history for ${key} at version ${version}`);
  return setSetting(key, row.value, {
    ...options,
    reason: options.reason ?? `rollback_to_v${version}`,
  });
}

export async function exportSettings(category?: SettingCategory) {
  const items = await listAllSettings({ category });
  return {
    exportedAt: new Date().toISOString(),
    category: category ?? 'all',
    settings: Object.fromEntries(items.map((i) => [i.key, i.value])),
  };
}

export async function importSettings(
  payload: Record<string, unknown>,
  options: SetSettingOptions = {},
) {
  const results: EffectiveSetting[] = [];
  for (const [key, value] of Object.entries(payload)) {
    if (!getSettingDefinition(key)) continue;
    const def = requireSettingDefinition(key);
    if (def.envOnly || def.editable === false) continue;
    results.push(
      await setSetting(key, value, {
        ...options,
        reason: options.reason ?? 'import',
      }),
    );
  }
  return results;
}

export function getCategories() {
  return listSettingCategories();
}

export async function addFavorite(userId: string, key: string) {
  requireSettingDefinition(key);
  await db.settingFavorite.upsert({
    where: { userId_key: { userId, key } },
    create: { userId, key },
    update: {},
  });
}

export async function removeFavorite(userId: string, key: string) {
  await db.settingFavorite.deleteMany({ where: { userId, key } });
}

export async function listFavorites(userId: string) {
  const rows = await db.settingFavorite.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  return Promise.all(rows.map((r) => getEffectiveSetting(r.key)));
}

export async function touchRecent(userId: string, key: string) {
  if (!getSettingDefinition(key)) return;
  await db.settingRecent.upsert({
    where: { userId_key: { userId, key } },
    create: { userId, key, accessedAt: new Date() },
    update: { accessedAt: new Date() },
  });
}

export async function listRecent(userId: string, take = 20) {
  const rows = await db.settingRecent.findMany({
    where: { userId },
    orderBy: { accessedAt: 'desc' },
    take,
  });
  return Promise.all(rows.map((r) => getEffectiveSetting(r.key)));
}

/** Typed helper used by adapters. */
export async function getGlobalNumber(key: string, fallback: number): Promise<number> {
  const v = await getSetting(key);
  return typeof v === 'number' ? v : fallback;
}

export async function getGlobalBoolean(key: string, fallback: boolean): Promise<boolean> {
  const v = await getSetting(key);
  return typeof v === 'boolean' ? v : fallback;
}

export async function getGlobalString(key: string, fallback: string): Promise<string> {
  const v = await getSetting(key);
  return typeof v === 'string' ? v : fallback;
}
