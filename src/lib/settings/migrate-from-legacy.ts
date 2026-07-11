import { db } from '@/lib/db';
import { parseSystemConfig, cloneDefaultSystemConfig } from '@/lib/system-config-defaults';
import { parseRbacMatrix, cloneDefaultMatrix } from '@/lib/rbac-defaults';
import { setSetting } from './service';
import { settingsCacheInvalidate } from './cache';

const KEY_MAP = {
  eligibilityPct: 'attendance.eligibility_pct',
  condonationPct: 'attendance.condonation_pct',
  requireHodForCondonation: 'attendance.require_hod_for_condonation',
  faceVerificationEnforced: 'policies.face_verification_enforced',
  geofenceSelfMarkRequired: 'policies.geofence_self_mark_required',
  knuctAnchorsEnabled: 'policies.knuct_anchors_enabled',
  auditLoggingEnabled: 'policies.audit_logging_enabled',
  defaultRadiusMeters: 'geofence.default_radius_meters',
  lowAttendanceWarningEnabled: 'notifications.low_attendance_warning',
  lowAttendanceEmailEnabled: 'notifications.low_attendance_email',
  violationAlertEnabled: 'notifications.violation_alert',
} as const;

/**
 * Flatten legacy SystemConfig + RbacConfig into SettingValue rows.
 * Idempotent: overwrites global values from legacy tables when present.
 */
export async function migrateLegacySettings(updatedBy = 'system:migrate'): Promise<{
  migrated: string[];
  skipped: string[];
}> {
  const migrated: string[] = [];
  const skipped: string[] = [];

  let config = cloneDefaultSystemConfig();
  try {
    const row = await db.systemConfig.findUnique({ where: { id: 'default' } });
    if (row) config = parseSystemConfig(row.settings);
  } catch {
    skipped.push('systemConfig_read_failed');
  }

  const pairs: [string, unknown][] = [
    [KEY_MAP.eligibilityPct, config.attendance.eligibilityPct],
    [KEY_MAP.condonationPct, config.attendance.condonationPct],
    [KEY_MAP.requireHodForCondonation, config.attendance.requireHodForCondonation],
    [KEY_MAP.faceVerificationEnforced, config.policies.faceVerificationEnforced],
    [KEY_MAP.geofenceSelfMarkRequired, config.policies.geofenceSelfMarkRequired],
    [KEY_MAP.knuctAnchorsEnabled, config.policies.knuctAnchorsEnabled],
    [KEY_MAP.auditLoggingEnabled, config.policies.auditLoggingEnabled],
    [KEY_MAP.defaultRadiusMeters, config.geofence.defaultRadiusMeters],
    [KEY_MAP.lowAttendanceWarningEnabled, config.notifications.lowAttendanceWarningEnabled],
    [KEY_MAP.lowAttendanceEmailEnabled, config.notifications.lowAttendanceEmailEnabled],
    [KEY_MAP.violationAlertEnabled, config.notifications.violationAlertEnabled],
  ];

  for (const [key, value] of pairs) {
    try {
      await setSetting(key, value, { updatedBy, reason: 'legacy_migrate', skipHistory: true });
      migrated.push(key);
    } catch (err) {
      skipped.push(`${key}:${err instanceof Error ? err.message : 'error'}`);
    }
  }

  let matrix = cloneDefaultMatrix();
  try {
    const rbac = await db.rbacConfig.findUnique({ where: { id: 'default' } });
    if (rbac) matrix = parseRbacMatrix(rbac.matrix);
  } catch {
    skipped.push('rbacConfig_read_failed');
  }

  try {
    await setSetting('rbac.matrix', matrix, { updatedBy, reason: 'legacy_migrate', skipHistory: true });
    migrated.push('rbac.matrix');
  } catch (err) {
    skipped.push(`rbac.matrix:${err instanceof Error ? err.message : 'error'}`);
  }

  // Seed general defaults if missing
  const generals: [string, unknown][] = [
    ['general.app_name', undefined],
    ['general.timezone', 'Asia/Kolkata'],
    ['general.date_format', 'dd/MM/yyyy'],
    ['general.session_timeout_minutes', 480],
    ['general.maintenance_mode', false],
    ['general.theme', 'light'],
    ['general.company_name', undefined],
    ['general.tagline', undefined],
    ['general.time_format', '12h'],
    ['general.language', 'en'],
    ['general.locale', 'en-IN'],
    ['general.currency', 'INR'],
    ['general.pagination_default', 20],
    ['general.landing_section', 'dashboard'],
    ['general.branding_primary_color', '#1A3C6E'],
    ['general.logo_url', undefined],
    ['general.favicon_url', undefined],
    ['general.copyright_text', undefined],
  ];
  for (const [key, fallback] of generals) {
    const existing = await db.settingValue.findUnique({
      where: { key_scope_scopeId: { key, scope: 'global', scopeId: '' } },
    });
    if (existing) {
      skipped.push(`${key}:exists`);
      continue;
    }
    if (fallback === undefined) continue;
    try {
      await setSetting(key, fallback, { updatedBy, reason: 'legacy_migrate_seed', skipHistory: true });
      migrated.push(key);
    } catch {
      skipped.push(key);
    }
  }

  settingsCacheInvalidate();
  return { migrated, skipped };
}

/** Ensure settings tables are populated; safe to call on boot. */
export async function ensureSettingsMigrated(): Promise<void> {
  try {
    const count = await db.settingValue.count({
      where: { key: { startsWith: 'attendance.' } },
    });
    if (count > 0) return;
    await migrateLegacySettings('system:boot');
  } catch (err) {
    console.warn('[settings] ensureSettingsMigrated skipped:', err);
  }
}
