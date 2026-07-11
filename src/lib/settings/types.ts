export type SettingScope = 'global' | 'organization' | 'department' | 'user';

export type SettingValueType =
  | 'string'
  | 'boolean'
  | 'number'
  | 'decimal'
  | 'date'
  | 'json'
  | 'array'
  | 'enum'
  | 'secret';

export type SettingCategory =
  | 'general'
  | 'organization'
  | 'users'
  | 'attendance'
  | 'policies'
  | 'geofence'
  | 'notifications'
  | 'lms'
  | 'integrations'
  | 'rbac'
  | 'audit'
  | 'flags'
  | 'runtime';

export interface SettingValidation {
  required?: boolean;
  min?: number;
  max?: number;
  regex?: string;
  allowedValues?: (string | number | boolean)[];
}

export interface SettingDefinition {
  key: string;
  category: SettingCategory;
  subcategory?: string;
  displayName: string;
  description: string;
  valueType: SettingValueType;
  defaultValue: unknown;
  validation?: SettingValidation;
  editable?: boolean;
  visible?: boolean;
  /** Value comes only from environment; not stored/edited in DB. */
  envOnly?: boolean;
  envKey?: string;
  /** Allow department/user overrides later; Phase 1 writes global only. */
  allowUserOverride?: boolean;
  allowDepartmentOverride?: boolean;
}

export interface SettingLayer {
  scope: SettingScope;
  scopeId: string;
  value: unknown;
  version?: number;
  updatedBy?: string | null;
  updatedAt?: string | null;
}

export interface EffectiveSetting {
  key: string;
  definition: SettingDefinition;
  value: unknown;
  source: SettingScope | 'env' | 'default';
  layers: SettingLayer[];
  version?: number;
  updatedBy?: string | null;
  updatedAt?: string | null;
}

export interface SetSettingOptions {
  scope?: SettingScope;
  scopeId?: string;
  updatedBy?: string;
  reason?: string;
  /** Skip writing history (used during bulk migrate). */
  skipHistory?: boolean;
}
