import type { SettingDefinition, SettingCategory } from './types';
import { cloneDefaultMatrix } from '@/lib/rbac-defaults';
import { BRAND } from '@/lib/branding';

const defs: SettingDefinition[] = [
  // General
  {
    key: 'general.app_name',
    category: 'general',
    displayName: 'Application name',
    description: 'Product name shown in the UI and emails.',
    valueType: 'string',
    defaultValue: BRAND.name,
    validation: { required: true },
  },
  {
    key: 'general.timezone',
    category: 'general',
    displayName: 'Timezone',
    description: 'Default campus timezone (IANA).',
    valueType: 'string',
    defaultValue: 'Asia/Kolkata',
  },
  {
    key: 'general.date_format',
    category: 'general',
    displayName: 'Date format',
    description: 'Preferred date display format.',
    valueType: 'enum',
    defaultValue: 'dd/MM/yyyy',
    validation: { allowedValues: ['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd'] },
  },
  {
    key: 'general.session_timeout_minutes',
    category: 'general',
    displayName: 'Session timeout (minutes)',
    description: 'Idle session timeout hint for clients (JWT refresh still applies).',
    valueType: 'number',
    defaultValue: 480,
    validation: { min: 15, max: 10080 },
  },
  {
    key: 'general.maintenance_mode',
    category: 'general',
    displayName: 'Maintenance mode',
    description: 'When enabled, non-admin users see a maintenance banner.',
    valueType: 'boolean',
    defaultValue: false,
  },
  {
    key: 'general.theme',
    category: 'general',
    displayName: 'Default theme',
    description: 'Default UI theme for new sessions.',
    valueType: 'enum',
    defaultValue: 'light',
    validation: { allowedValues: ['light', 'dark', 'system'] },
  },

  // Attendance
  {
    key: 'attendance.eligibility_pct',
    category: 'attendance',
    displayName: 'Eligibility attendance %',
    description: 'Minimum attendance percentage for exam eligibility.',
    valueType: 'number',
    defaultValue: 75,
    validation: { min: 0, max: 100, required: true },
  },
  {
    key: 'attendance.condonation_pct',
    category: 'attendance',
    displayName: 'Condonation attendance %',
    description: 'Lower bound for condonation consideration.',
    valueType: 'number',
    defaultValue: 65,
    validation: { min: 0, max: 100, required: true },
  },
  {
    key: 'attendance.require_hod_for_condonation',
    category: 'attendance',
    displayName: 'Require HOD for condonation',
    description: 'HOD approval required for condonation requests.',
    valueType: 'boolean',
    defaultValue: true,
  },

  // Policies
  {
    key: 'policies.face_verification_enforced',
    category: 'policies',
    displayName: 'Enforce face verification',
    description: 'Reject self-mark when face match fails (requires face API).',
    valueType: 'boolean',
    defaultValue: false,
  },
  {
    key: 'policies.geofence_self_mark_required',
    category: 'policies',
    displayName: 'Require geofence for self-mark',
    description: 'Students must be inside the session geofence to mark attendance.',
    valueType: 'boolean',
    defaultValue: true,
  },
  {
    key: 'policies.knuct_anchors_enabled',
    category: 'policies',
    displayName: 'Knuct anchors enabled',
    description: 'Record blockchain audit anchors for key events.',
    valueType: 'boolean',
    defaultValue: true,
  },
  {
    key: 'policies.audit_logging_enabled',
    category: 'policies',
    displayName: 'Audit logging enabled',
    description: 'Write security and admin actions to the audit log.',
    valueType: 'boolean',
    defaultValue: true,
  },

  // Geofence
  {
    key: 'geofence.default_radius_meters',
    category: 'geofence',
    displayName: 'Default geofence radius (m)',
    description: 'Default circle radius when creating geofences.',
    valueType: 'number',
    defaultValue: 100,
    validation: { min: 10, max: 5000 },
  },

  // Notifications
  {
    key: 'notifications.low_attendance_warning',
    category: 'notifications',
    displayName: 'Low attendance in-app warning',
    description: 'Notify students (and parents) when attendance falls below eligibility.',
    valueType: 'boolean',
    defaultValue: true,
  },
  {
    key: 'notifications.low_attendance_email',
    category: 'notifications',
    displayName: 'Low attendance email',
    description: 'Send email/SMS for low attendance when providers are configured.',
    valueType: 'boolean',
    defaultValue: false,
  },
  {
    key: 'notifications.violation_alert',
    category: 'notifications',
    displayName: 'Violation / integrity alerts',
    description: 'Notify on failed geofence or face verification marks.',
    valueType: 'boolean',
    defaultValue: true,
  },

  // RBAC
  {
    key: 'rbac.matrix',
    category: 'rbac',
    displayName: 'Role × section matrix',
    description: 'Navigation and API section access by role.',
    valueType: 'json',
    defaultValue: cloneDefaultMatrix(),
    editable: true,
  },

  // Flags (env-only example)
  {
    key: 'flags.demo_auth_visible',
    category: 'flags',
    displayName: 'Demo auth allowed',
    description: 'Whether demo password / role switcher is allowed (from ALLOW_DEMO_AUTH / NODE_ENV).',
    valueType: 'boolean',
    defaultValue: false,
    editable: false,
    envOnly: true,
    envKey: 'ALLOW_DEMO_AUTH',
  },
];

const byKey = new Map(defs.map((d) => [d.key, d]));

export function listSettingDefinitions(category?: SettingCategory): SettingDefinition[] {
  const list = category ? defs.filter((d) => d.category === category) : [...defs];
  return list.filter((d) => d.visible !== false);
}

export function getSettingDefinition(key: string): SettingDefinition | undefined {
  return byKey.get(key);
}

export function requireSettingDefinition(key: string): SettingDefinition {
  const def = byKey.get(key);
  if (!def) throw new Error(`Unknown setting key: ${key}`);
  return def;
}

export function listSettingCategories(): { id: SettingCategory; label: string; keys: string[] }[] {
  const order: { id: SettingCategory; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'policies', label: 'Policies' },
    { id: 'geofence', label: 'Geofence' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'rbac', label: 'RBAC' },
    { id: 'flags', label: 'Feature flags' },
    { id: 'runtime', label: 'Runtime / environment' },
  ];
  return order.map((c) => ({
    ...c,
    keys: defs.filter((d) => d.category === c.id).map((d) => d.key),
  }));
}

export function validateSettingValue(def: SettingDefinition, value: unknown): string | null {
  const v = def.validation;
  if (def.envOnly) return 'This setting is environment-only and cannot be set in the database.';
  if (def.editable === false) return 'This setting is not editable.';

  if (v?.required && (value === null || value === undefined || value === '')) {
    return 'Value is required.';
  }

  switch (def.valueType) {
    case 'boolean':
      if (typeof value !== 'boolean') return 'Expected boolean.';
      break;
    case 'number':
    case 'decimal':
      if (typeof value !== 'number' || Number.isNaN(value)) return 'Expected number.';
      if (v?.min != null && value < v.min) return `Minimum is ${v.min}.`;
      if (v?.max != null && value > v.max) return `Maximum is ${v.max}.`;
      break;
    case 'string':
    case 'secret':
      if (typeof value !== 'string') return 'Expected string.';
      if (v?.regex && !new RegExp(v.regex).test(value)) return 'Value does not match required pattern.';
      break;
    case 'enum':
      if (v?.allowedValues && !v.allowedValues.includes(value as string | number | boolean)) {
        return `Allowed values: ${v.allowedValues.join(', ')}`;
      }
      break;
    case 'json':
    case 'array':
      if (value === undefined) return 'Expected JSON value.';
      break;
    default:
      break;
  }

  if (v?.allowedValues && def.valueType !== 'enum') {
    if (!v.allowedValues.includes(value as string | number | boolean)) {
      return `Allowed values: ${v.allowedValues.join(', ')}`;
    }
  }

  if (def.key === 'attendance.eligibility_pct' || def.key === 'attendance.condonation_pct') {
    // Cross-field check happens in adapter when saving full config.
  }

  return null;
}
