import { getGlobalBoolean, getGlobalNumber, getSetting } from './service';

export type OrgSettings = {
  weekStartsOn: number;
  workingDays: number[];
  holidayBlockAttendance: boolean;
  requireActiveAcademicYear: boolean;
};

export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  weekStartsOn: 1,
  workingDays: [1, 2, 3, 4, 5],
  holidayBlockAttendance: false,
  requireActiveAcademicYear: true,
};

function parseWorkingDays(raw: unknown): number[] {
  if (!Array.isArray(raw)) return DEFAULT_ORG_SETTINGS.workingDays;
  const days = raw
    .map((d) => (typeof d === 'number' ? d : Number(d)))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  return days.length > 0 ? [...new Set(days)].sort((a, b) => a - b) : DEFAULT_ORG_SETTINGS.workingDays;
}

export async function getOrgSettings(): Promise<OrgSettings> {
  const [weekStartsOn, workingDaysRaw, holidayBlockAttendance, requireActiveAcademicYear] =
    await Promise.all([
      getGlobalNumber('organization.week_starts_on', DEFAULT_ORG_SETTINGS.weekStartsOn),
      getSetting('organization.working_days'),
      getGlobalBoolean('organization.holiday_block_attendance', DEFAULT_ORG_SETTINGS.holidayBlockAttendance),
      getGlobalBoolean(
        'organization.require_active_academic_year',
        DEFAULT_ORG_SETTINGS.requireActiveAcademicYear,
      ),
    ]);

  const week = Math.min(6, Math.max(0, Math.round(weekStartsOn)));
  return {
    weekStartsOn: week,
    workingDays: parseWorkingDays(workingDaysRaw),
    holidayBlockAttendance: Boolean(holidayBlockAttendance),
    requireActiveAcademicYear: Boolean(requireActiveAcademicYear),
  };
}

/** True when date falls on a non-working day per org settings. */
export function isNonWorkingDay(date: Date, settings: OrgSettings): boolean {
  return !settings.workingDays.includes(date.getDay());
}
