/**
 * Shared attendance % math and threshold bands.
 * Rule (campus-wide): late counts as present for eligibility percentage.
 */

export type AttendanceThresholdsLite = {
  eligibilityPct: number;
  condonationPct: number;
};

export const DEFAULT_ATTENDANCE_THRESHOLDS_LITE: AttendanceThresholdsLite = {
  eligibilityPct: 75,
  condonationPct: 65,
};

/** Statuses that count toward the attendance numerator. */
export function countsAsPresent(status: string): boolean {
  return status === 'present' || status === 'late';
}

export function attendancePercentage(presentLike: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((presentLike / total) * 100);
}

export function attendancePercentageFromCounts(counts: {
  present: number;
  late?: number;
  total: number;
}): number {
  return attendancePercentage(counts.present + (counts.late ?? 0), counts.total);
}

/** Session rollup rate: (present + late) / expected. */
export function sessionAttendanceRate(session: {
  presentCount: number;
  lateCount?: number;
  expectedCount: number;
}): number {
  if (session.expectedCount <= 0) return 0;
  return Math.round(
    ((session.presentCount + (session.lateCount ?? 0)) / session.expectedCount) * 100,
  );
}

export type AttendanceBand = 'eligible' | 'watch' | 'at_risk' | 'no_data';

export function attendanceBand(
  pct: number,
  total: number,
  t: AttendanceThresholdsLite = DEFAULT_ATTENDANCE_THRESHOLDS_LITE,
): AttendanceBand {
  if (total <= 0) return 'no_data';
  if (pct >= t.eligibilityPct) return 'eligible';
  if (pct >= t.condonationPct) return 'watch';
  return 'at_risk';
}

export function attendancePctTextClass(
  pct: number,
  t: AttendanceThresholdsLite = DEFAULT_ATTENDANCE_THRESHOLDS_LITE,
): string {
  if (pct >= t.eligibilityPct) return 'text-emerald-600';
  if (pct >= t.condonationPct) return 'text-amber-600';
  return 'text-red-600';
}

export function attendancePctBgClass(
  pct: number,
  t: AttendanceThresholdsLite = DEFAULT_ATTENDANCE_THRESHOLDS_LITE,
): string {
  if (pct >= t.eligibilityPct) return 'bg-emerald-100 dark:bg-emerald-900/30';
  if (pct >= t.condonationPct) return 'bg-amber-100 dark:bg-amber-900/30';
  return 'bg-red-100 dark:bg-red-900/30';
}

/** Hex colors for SVG rings / accents. */
export function attendancePctHexColor(
  pct: number,
  t: AttendanceThresholdsLite = DEFAULT_ATTENDANCE_THRESHOLDS_LITE,
): string {
  if (pct >= t.eligibilityPct) return '#0E7490';
  if (pct >= t.condonationPct) return '#B45309';
  return '#E74C3C';
}
