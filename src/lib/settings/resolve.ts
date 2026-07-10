import type { SettingScope } from './types';

export type ResolveLayer = {
  scope: SettingScope;
  scopeId: string;
  value: unknown;
  version?: number;
  updatedBy?: string | null;
  updatedAt?: string | null;
};

export type ResolveResult = {
  value: unknown;
  source: SettingScope | 'env' | 'default';
  version?: number;
  updatedBy?: string | null;
  updatedAt?: string | null;
};

/**
 * Pure resolution: env → user → department → organization → global → default
 */
export function resolveEffectiveValue(opts: {
  defaultValue: unknown;
  envValue?: unknown;
  layers: ResolveLayer[];
  userId?: string;
  departmentId?: string;
  organizationId?: string;
}): ResolveResult {
  const pick = (scope: SettingScope, scopeId: string) =>
    opts.layers.find((l) => l.scope === scope && l.scopeId === scopeId);

  if (opts.envValue !== undefined) {
    return { value: opts.envValue, source: 'env' };
  }

  if (opts.userId) {
    const u = pick('user', opts.userId);
    if (u) {
      return {
        value: u.value,
        source: 'user',
        version: u.version,
        updatedBy: u.updatedBy,
        updatedAt: u.updatedAt,
      };
    }
  }

  if (opts.departmentId) {
    const d = pick('department', opts.departmentId);
    if (d) {
      return {
        value: d.value,
        source: 'department',
        version: d.version,
        updatedBy: d.updatedBy,
        updatedAt: d.updatedAt,
      };
    }
  }

  if (opts.organizationId) {
    const o = pick('organization', opts.organizationId);
    if (o) {
      return {
        value: o.value,
        source: 'organization',
        version: o.version,
        updatedBy: o.updatedBy,
        updatedAt: o.updatedAt,
      };
    }
  }

  const g = pick('global', '');
  if (g) {
    return {
      value: g.value,
      source: 'global',
      version: g.version,
      updatedBy: g.updatedBy,
      updatedAt: g.updatedAt,
    };
  }

  return { value: opts.defaultValue, source: 'default' };
}
