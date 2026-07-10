import {
  cloneDefaultSystemConfig,
  validateSystemConfig,
  type SystemConfigSettings,
} from '@/lib/system-config-defaults';
import { getSetting, setSetting, settingsCacheInvalidate } from '@/lib/settings';
import { db } from '@/lib/db';

async function readFromSettings(): Promise<SystemConfigSettings> {
  const base = cloneDefaultSystemConfig();
  const num = async (key: string, fallback: number) => {
    const v = await getSetting(key);
    return typeof v === 'number' ? v : fallback;
  };
  const bool = async (key: string, fallback: boolean) => {
    const v = await getSetting(key);
    return typeof v === 'boolean' ? v : fallback;
  };

  base.attendance.eligibilityPct = await num('attendance.eligibility_pct', base.attendance.eligibilityPct);
  base.attendance.condonationPct = await num('attendance.condonation_pct', base.attendance.condonationPct);
  base.attendance.requireHodForCondonation = await bool(
    'attendance.require_hod_for_condonation',
    base.attendance.requireHodForCondonation,
  );
  base.policies.faceVerificationEnforced = await bool(
    'policies.face_verification_enforced',
    base.policies.faceVerificationEnforced,
  );
  base.policies.geofenceSelfMarkRequired = await bool(
    'policies.geofence_self_mark_required',
    base.policies.geofenceSelfMarkRequired,
  );
  base.policies.knuctAnchorsEnabled = await bool(
    'policies.knuct_anchors_enabled',
    base.policies.knuctAnchorsEnabled,
  );
  base.policies.auditLoggingEnabled = await bool(
    'policies.audit_logging_enabled',
    base.policies.auditLoggingEnabled,
  );
  base.geofence.defaultRadiusMeters = await num(
    'geofence.default_radius_meters',
    base.geofence.defaultRadiusMeters,
  );
  base.notifications.lowAttendanceWarningEnabled = await bool(
    'notifications.low_attendance_warning',
    base.notifications.lowAttendanceWarningEnabled,
  );
  base.notifications.lowAttendanceEmailEnabled = await bool(
    'notifications.low_attendance_email',
    base.notifications.lowAttendanceEmailEnabled,
  );
  base.notifications.violationAlertEnabled = await bool(
    'notifications.violation_alert',
    base.notifications.violationAlertEnabled,
  );
  return base;
}

export async function loadSystemConfigViaSettings(): Promise<SystemConfigSettings> {
  try {
    return await readFromSettings();
  } catch {
    // Fallback to legacy table if settings tables not ready
    try {
      const row = await db.systemConfig.findUnique({ where: { id: 'default' } });
      if (row) {
        const { parseSystemConfig } = await import('@/lib/system-config-defaults');
        return parseSystemConfig(row.settings);
      }
    } catch {
      /* ignore */
    }
    return cloneDefaultSystemConfig();
  }
}

export async function saveSystemConfigViaSettings(
  settings: SystemConfigSettings,
  updatedBy: string,
): Promise<SystemConfigSettings> {
  const validated = validateSystemConfig(settings);
  if ('error' in validated) throw new Error(validated.error);
  const s = validated.settings;

  const pairs: [string, unknown][] = [
    ['attendance.eligibility_pct', s.attendance.eligibilityPct],
    ['attendance.condonation_pct', s.attendance.condonationPct],
    ['attendance.require_hod_for_condonation', s.attendance.requireHodForCondonation],
    ['policies.face_verification_enforced', s.policies.faceVerificationEnforced],
    ['policies.geofence_self_mark_required', s.policies.geofenceSelfMarkRequired],
    ['policies.knuct_anchors_enabled', s.policies.knuctAnchorsEnabled],
    ['policies.audit_logging_enabled', s.policies.auditLoggingEnabled],
    ['geofence.default_radius_meters', s.geofence.defaultRadiusMeters],
    ['notifications.low_attendance_warning', s.notifications.lowAttendanceWarningEnabled],
    ['notifications.low_attendance_email', s.notifications.lowAttendanceEmailEnabled],
    ['notifications.violation_alert', s.notifications.violationAlertEnabled],
  ];

  for (const [key, value] of pairs) {
    await setSetting(key, value, { updatedBy, reason: 'system_config_save' });
  }

  // Dual-write legacy blob for one release
  await db.systemConfig.upsert({
    where: { id: 'default' },
    create: { id: 'default', settings: s, updatedBy },
    update: { settings: s, updatedBy },
  });

  settingsCacheInvalidate();
  return s;
}
