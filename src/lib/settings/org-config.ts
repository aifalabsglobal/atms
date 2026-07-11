import { getGlobalBoolean, getGlobalNumber, getGlobalString, getSetting } from './service';
import {
  DEFAULT_ORG_SETTINGS,
  type ExamDayAttendancePolicy,
  type OrgSettings,
  type SaturdayMode,
} from './org-defaults';

export type { OrgSettings, ExamDayAttendancePolicy, SaturdayMode };
export { DEFAULT_ORG_SETTINGS };

const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const WEEKDAY_SHORT_TO_DOW: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function parseWorkingDays(raw: unknown): number[] {
  if (!Array.isArray(raw)) return DEFAULT_ORG_SETTINGS.workingDays;
  const days = raw
    .map((d) => (typeof d === 'number' ? d : Number(d)))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  return days.length > 0 ? [...new Set(days)].sort((a, b) => a - b) : DEFAULT_ORG_SETTINGS.workingDays;
}

function parseHhMmSetting(raw: string, fallback: string): string {
  const v = raw.trim();
  return HH_MM.test(v) ? v : fallback;
}

function parseExamDayPolicy(raw: string): ExamDayAttendancePolicy {
  if (raw === 'blocked' || raw === 'optional' || raw === 'allowed') return raw;
  return DEFAULT_ORG_SETTINGS.examDayAttendance;
}

function parseSaturdayMode(raw: string): SaturdayMode {
  if (raw === 'full' || raw === 'half' || raw === 'off' || raw === 'alternate') return raw;
  return DEFAULT_ORG_SETTINGS.saturdayMode;
}

/** Minutes from midnight for HH:mm, or null if invalid. */
export function parseHhMmToMinutes(value: string): number | null {
  const m = HH_MM.exec(value.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function getClockMinutesInTimeZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const h = hour === 24 ? 0 : hour;
  return h * 60 + minute;
}

/** Calendar YMD + weekday in a campus timezone. */
export function getZonedCalendarDay(
  date: Date,
  timeZone: string,
): { ymd: string; dayOfWeek: number } {
  const tz = timeZone || 'Asia/Kolkata';
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
  }).format(date);
  const dayOfWeek = WEEKDAY_SHORT_TO_DOW[weekday] ?? new Date(`${ymd}T12:00:00`).getDay();
  return { ymd, dayOfWeek };
}

/** ISO week number (1–53) for alternate-Saturday rules. */
export function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Odd ISO weeks are working under `alternate` Saturday mode. */
export function isAlternateSaturdayWorking(date: Date): boolean {
  return getISOWeekNumber(date) % 2 === 1;
}

/**
 * Campus working day including Saturday mode.
 * Saturday is governed by saturdayMode; other days use workingDays.
 */
export function isCampusWorkingDay(date: Date, settings: OrgSettings): boolean {
  const dow = date.getDay();
  if (dow === 6) {
    switch (settings.saturdayMode) {
      case 'off':
        return false;
      case 'full':
      case 'half':
        return true;
      case 'alternate':
        return isAlternateSaturdayWorking(date);
      default:
        return settings.workingDays.includes(6);
    }
  }
  return settings.workingDays.includes(dow);
}

/** Effective close time for a calendar date (half-day Saturday uses halfDayEndTime). */
export function getEffectiveDayEndTime(date: Date, settings: OrgSettings): string {
  if (date.getDay() === 6 && settings.saturdayMode === 'half') {
    return settings.halfDayEndTime;
  }
  return settings.dayEndTime;
}

/** Effective close time for "now" in campus timezone (half-day Saturday uses halfDayEndTime). */
export function getEffectiveDayEndTimeInZone(
  now: Date,
  settings: OrgSettings,
  timeZone: string,
): string {
  const { dayOfWeek } = getZonedCalendarDay(now, timeZone);
  if (dayOfWeek === 6 && settings.saturdayMode === 'half') {
    return settings.halfDayEndTime;
  }
  return settings.dayEndTime;
}

/** True when `now` is outside campus open→effective-close in the given timezone. */
export function isOutsideCampusDayHours(
  now: Date,
  settings: OrgSettings,
  timeZone: string,
): boolean {
  const start = parseHhMmToMinutes(settings.dayStartTime);
  const end = parseHhMmToMinutes(getEffectiveDayEndTimeInZone(now, settings, timeZone));
  if (start == null || end == null) return false;
  const nowMins = getClockMinutesInTimeZone(now, timeZone || 'Asia/Kolkata');
  if (start <= end) {
    return nowMins < start || nowMins > end;
  }
  return nowMins > end && nowMins < start;
}

export async function getOrgSettings(): Promise<OrgSettings> {
  const [
    weekStartsOn,
    workingDaysRaw,
    holidayBlockAttendance,
    dayStartTime,
    dayEndTime,
    enforceDayHours,
    saturdayMode,
    halfDayEndTime,
    examDayAttendance,
    periodMinutes,
    breakMinutes,
    periodsPerDay,
    requireActiveAcademicYear,
    allowMultipleActiveYears,
    defaultRegulation,
    lockCompletedAcademicYears,
    requireSemesterForPublish,
    autoPromoteAcademicYear,
    campusCode,
    aisheCode,
    campusAddress,
    campusPhone,
    principalTitle,
  ] = await Promise.all([
    getGlobalNumber('organization.week_starts_on', DEFAULT_ORG_SETTINGS.weekStartsOn),
    getSetting('organization.working_days'),
    getGlobalBoolean('organization.holiday_block_attendance', DEFAULT_ORG_SETTINGS.holidayBlockAttendance),
    getGlobalString('organization.day_start_time', DEFAULT_ORG_SETTINGS.dayStartTime),
    getGlobalString('organization.day_end_time', DEFAULT_ORG_SETTINGS.dayEndTime),
    getGlobalBoolean('organization.enforce_day_hours', DEFAULT_ORG_SETTINGS.enforceDayHours),
    getGlobalString('organization.saturday_mode', DEFAULT_ORG_SETTINGS.saturdayMode),
    getGlobalString('organization.half_day_end_time', DEFAULT_ORG_SETTINGS.halfDayEndTime),
    getGlobalString('organization.exam_day_attendance', DEFAULT_ORG_SETTINGS.examDayAttendance),
    getGlobalNumber('organization.period_minutes', DEFAULT_ORG_SETTINGS.periodMinutes),
    getGlobalNumber('organization.break_minutes', DEFAULT_ORG_SETTINGS.breakMinutes),
    getGlobalNumber('organization.periods_per_day', DEFAULT_ORG_SETTINGS.periodsPerDay),
    getGlobalBoolean(
      'organization.require_active_academic_year',
      DEFAULT_ORG_SETTINGS.requireActiveAcademicYear,
    ),
    getGlobalBoolean(
      'organization.allow_multiple_active_years',
      DEFAULT_ORG_SETTINGS.allowMultipleActiveYears,
    ),
    getGlobalString('organization.default_regulation', DEFAULT_ORG_SETTINGS.defaultRegulation),
    getGlobalBoolean(
      'organization.lock_completed_academic_years',
      DEFAULT_ORG_SETTINGS.lockCompletedAcademicYears,
    ),
    getGlobalBoolean(
      'organization.require_semester_for_publish',
      DEFAULT_ORG_SETTINGS.requireSemesterForPublish,
    ),
    getGlobalBoolean(
      'organization.auto_promote_academic_year',
      DEFAULT_ORG_SETTINGS.autoPromoteAcademicYear,
    ),
    getGlobalString('organization.campus_code', DEFAULT_ORG_SETTINGS.campusCode),
    getGlobalString('organization.aishe_code', DEFAULT_ORG_SETTINGS.aisheCode),
    getGlobalString('organization.campus_address', DEFAULT_ORG_SETTINGS.campusAddress),
    getGlobalString('organization.campus_phone', DEFAULT_ORG_SETTINGS.campusPhone),
    getGlobalString('organization.principal_title', DEFAULT_ORG_SETTINGS.principalTitle),
  ]);

  const week = Math.min(6, Math.max(0, Math.round(weekStartsOn)));
  return {
    weekStartsOn: week,
    workingDays: parseWorkingDays(workingDaysRaw),
    holidayBlockAttendance: Boolean(holidayBlockAttendance),
    dayStartTime: parseHhMmSetting(dayStartTime, DEFAULT_ORG_SETTINGS.dayStartTime),
    dayEndTime: parseHhMmSetting(dayEndTime, DEFAULT_ORG_SETTINGS.dayEndTime),
    enforceDayHours: Boolean(enforceDayHours),
    saturdayMode: parseSaturdayMode(saturdayMode),
    halfDayEndTime: parseHhMmSetting(halfDayEndTime, DEFAULT_ORG_SETTINGS.halfDayEndTime),
    examDayAttendance: parseExamDayPolicy(examDayAttendance),
    periodMinutes: Math.max(15, Math.min(240, Math.round(periodMinutes))),
    breakMinutes: Math.max(0, Math.min(120, Math.round(breakMinutes))),
    periodsPerDay: Math.max(1, Math.min(12, Math.round(periodsPerDay))),
    requireActiveAcademicYear: Boolean(requireActiveAcademicYear),
    allowMultipleActiveYears: Boolean(allowMultipleActiveYears),
    defaultRegulation: (defaultRegulation || DEFAULT_ORG_SETTINGS.defaultRegulation).trim() || 'R22',
    lockCompletedAcademicYears: Boolean(lockCompletedAcademicYears),
    requireSemesterForPublish: Boolean(requireSemesterForPublish),
    autoPromoteAcademicYear: Boolean(autoPromoteAcademicYear),
    campusCode: campusCode.trim(),
    aisheCode: aisheCode.trim(),
    campusAddress: campusAddress.trim(),
    campusPhone: campusPhone.trim(),
    principalTitle: principalTitle.trim(),
  };
}

/** @deprecated Prefer isCampusWorkingDay — ignores Saturday mode. */
export function isNonWorkingDay(date: Date, settings: OrgSettings): boolean {
  return !isCampusWorkingDay(date, settings);
}
