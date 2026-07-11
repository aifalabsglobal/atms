import type { OrgSettings } from './org-defaults';

const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Add minutes to HH:mm (wraps past midnight). */
export function addMinutesToHhMm(hhmm: string, minutes: number): string {
  const m = HH_MM.exec(hhmm.trim());
  if (!m) return hhmm;
  const total = (Number(m[1]) * 60 + Number(m[2]) + minutes + 24 * 60) % (24 * 60);
  const h = Math.floor(total / 60);
  const min = total % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export type PeriodBand = {
  period: number;
  startTime: string;
  endTime: string;
};

/** First period times from campus day start + period length. */
export function suggestFirstPeriodTimes(
  settings: Pick<OrgSettings, 'dayStartTime' | 'periodMinutes'>,
): { startTime: string; endTime: string } {
  const startTime = settings.dayStartTime || '08:00';
  const mins = Math.max(15, Math.min(240, settings.periodMinutes || 50));
  return { startTime, endTime: addMinutesToHhMm(startTime, mins) };
}

/** Full-day suggested bands: period then break, repeated. */
export function buildPeriodSchedule(
  settings: Pick<OrgSettings, 'dayStartTime' | 'dayEndTime' | 'periodMinutes' | 'breakMinutes' | 'periodsPerDay'>,
): PeriodBand[] {
  const periodMins = Math.max(15, Math.min(240, settings.periodMinutes || 50));
  const breakMins = Math.max(0, Math.min(120, settings.breakMinutes || 0));
  const count = Math.max(1, Math.min(12, settings.periodsPerDay || 6));
  const dayEnd = settings.dayEndTime || '17:00';
  const bands: PeriodBand[] = [];
  let cursor = settings.dayStartTime || '08:00';

  for (let i = 1; i <= count; i++) {
    const endTime = addMinutesToHhMm(cursor, periodMins);
    if (endTime > dayEnd && cursor >= dayEnd) break;
    bands.push({
      period: i,
      startTime: cursor,
      endTime: endTime > dayEnd ? dayEnd : endTime,
    });
    cursor = addMinutesToHhMm(bands[bands.length - 1]!.endTime, breakMins);
    if (cursor >= dayEnd) break;
  }
  return bands;
}

export function formatTimetableDefaultsPreview(
  settings: Pick<OrgSettings, 'periodMinutes' | 'breakMinutes' | 'periodsPerDay' | 'dayStartTime'>,
): string {
  const first = suggestFirstPeriodTimes(settings);
  return `${settings.periodsPerDay} periods × ${settings.periodMinutes} min + ${settings.breakMinutes} min break · first ${first.startTime}–${first.endTime}`;
}

/** Default day-of-week string for new slots (first working weekday, else Monday). */
export function defaultTimetableDayOfWeek(
  settings: Pick<OrgSettings, 'workingDays' | 'saturdayMode'>,
): string {
  const preferred = settings.workingDays.find((d) => d >= 1 && d <= 5);
  if (preferred != null) return String(preferred);
  if (settings.saturdayMode !== 'off' && settings.workingDays.includes(6)) return '6';
  if (settings.saturdayMode !== 'off') return '6';
  return '1';
}

export type TimetableDayOption = { value: string; label: string };

const ALL_TIMETABLE_DAYS: TimetableDayOption[] = [
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
  { value: '0', label: 'Sunday' },
];

/** Day options filtered by working days + Saturday mode. */
export function timetableDayOptions(
  settings: Pick<OrgSettings, 'workingDays' | 'saturdayMode'>,
): TimetableDayOption[] {
  const filtered = ALL_TIMETABLE_DAYS.filter((d) => {
    const n = Number(d.value);
    if (n === 6) return settings.saturdayMode !== 'off';
    return settings.workingDays.includes(n);
  });
  return filtered.length > 0 ? filtered : ALL_TIMETABLE_DAYS.filter((d) => d.value !== '0' && d.value !== '6');
}
