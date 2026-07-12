export interface AttendanceThresholds {
  eligibilityPct: number;
  condonationPct: number;
  requireHodForCondonation: boolean;
}

export interface SystemPolicies {
  faceVerificationEnforced: boolean;
  geofenceSelfMarkRequired: boolean;
  knuctAnchorsEnabled: boolean;
  auditLoggingEnabled: boolean;
}

export interface GeofenceDefaults {
  defaultRadiusMeters: number;
}

export interface NotificationPolicies {
  lowAttendanceWarningEnabled: boolean;
  lowAttendanceEmailEnabled: boolean;
  violationAlertEnabled: boolean;
}

export interface SystemConfigSettings {
  attendance: AttendanceThresholds;
  policies: SystemPolicies;
  geofence: GeofenceDefaults;
  notifications: NotificationPolicies;
}

export const DEFAULT_ATTENDANCE_THRESHOLDS: AttendanceThresholds = {
  eligibilityPct: 75,
  condonationPct: 65,
  requireHodForCondonation: true,
};

/** Client-safe band helper — keep out of server-only modules (e.g. reports-analytics). */
export function attendanceRiskStatus(
  pct: number,
  total: number,
  thresholds: AttendanceThresholds = DEFAULT_ATTENDANCE_THRESHOLDS,
): 'on_track' | 'watch' | 'at_risk' | 'no_data' {
  if (total === 0) return 'no_data';
  if (pct >= thresholds.eligibilityPct) return 'on_track';
  if (pct >= thresholds.condonationPct) return 'watch';
  return 'at_risk';
}

export const DEFAULT_SYSTEM_CONFIG: SystemConfigSettings = {
  attendance: DEFAULT_ATTENDANCE_THRESHOLDS,
  policies: {
    faceVerificationEnforced: false,
    geofenceSelfMarkRequired: true,
    knuctAnchorsEnabled: true,
    auditLoggingEnabled: true,
  },
  geofence: {
    defaultRadiusMeters: 100,
  },
  notifications: {
    lowAttendanceWarningEnabled: true,
    lowAttendanceEmailEnabled: false,
    violationAlertEnabled: true,
  },
};

export function cloneDefaultSystemConfig(): SystemConfigSettings {
  return JSON.parse(JSON.stringify(DEFAULT_SYSTEM_CONFIG)) as SystemConfigSettings;
}

export function parseSystemConfig(raw: unknown): SystemConfigSettings {
  const base = cloneDefaultSystemConfig();
  if (!raw || typeof raw !== 'object') return base;

  const obj = raw as Record<string, unknown>;
  const attendance = obj.attendance as Record<string, unknown> | undefined;
  const policies = obj.policies as Record<string, unknown> | undefined;
  const geofence = obj.geofence as Record<string, unknown> | undefined;
  const notifications = obj.notifications as Record<string, unknown> | undefined;

  if (attendance) {
    if (typeof attendance.eligibilityPct === 'number') base.attendance.eligibilityPct = attendance.eligibilityPct;
    if (typeof attendance.condonationPct === 'number') base.attendance.condonationPct = attendance.condonationPct;
    if (typeof attendance.requireHodForCondonation === 'boolean') {
      base.attendance.requireHodForCondonation = attendance.requireHodForCondonation;
    }
  }

  if (policies) {
    if (typeof policies.faceVerificationEnforced === 'boolean') {
      base.policies.faceVerificationEnforced = policies.faceVerificationEnforced;
    }
    if (typeof policies.geofenceSelfMarkRequired === 'boolean') {
      base.policies.geofenceSelfMarkRequired = policies.geofenceSelfMarkRequired;
    }
    if (typeof policies.knuctAnchorsEnabled === 'boolean') {
      base.policies.knuctAnchorsEnabled = policies.knuctAnchorsEnabled;
    }
    if (typeof policies.auditLoggingEnabled === 'boolean') {
      base.policies.auditLoggingEnabled = policies.auditLoggingEnabled;
    }
  }

  if (geofence && typeof geofence.defaultRadiusMeters === 'number') {
    base.geofence.defaultRadiusMeters = geofence.defaultRadiusMeters;
  }

  if (notifications) {
    if (typeof notifications.lowAttendanceWarningEnabled === 'boolean') {
      base.notifications.lowAttendanceWarningEnabled = notifications.lowAttendanceWarningEnabled;
    }
    if (typeof notifications.lowAttendanceEmailEnabled === 'boolean') {
      base.notifications.lowAttendanceEmailEnabled = notifications.lowAttendanceEmailEnabled;
    }
    if (typeof notifications.violationAlertEnabled === 'boolean') {
      base.notifications.violationAlertEnabled = notifications.violationAlertEnabled;
    }
  }

  return base;
}

export function validateSystemConfig(
  settings: SystemConfigSettings,
): { settings: SystemConfigSettings } | { error: string } {
  const { eligibilityPct, condonationPct } = settings.attendance;
  if (!Number.isFinite(eligibilityPct) || eligibilityPct < 50 || eligibilityPct > 100) {
    return { error: 'Eligibility threshold must be between 50 and 100' };
  }
  if (!Number.isFinite(condonationPct) || condonationPct < 0 || condonationPct > 100) {
    return { error: 'Condonation threshold must be between 0 and 100' };
  }
  if (condonationPct > eligibilityPct) {
    return { error: 'Condonation threshold cannot exceed eligibility threshold' };
  }

  const radius = settings.geofence.defaultRadiusMeters;
  if (!Number.isFinite(radius) || radius < 10 || radius > 5000) {
    return { error: 'Default geofence radius must be between 10 and 5000 meters' };
  }

  return { settings };
}
