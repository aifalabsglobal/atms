export type ActiveAcademicYearSummary = {
  id: string;
  name: string;
  code: string;
  startDate: string;
  endDate: string;
  regulation: string | null;
  status: string;
};

/** Used when no academic year is marked active. */
export const FALLBACK_ACADEMIC_RANGE = {
  id: null as string | null,
  name: 'Academic year',
  code: null as string | null,
  startDate: '2025-07-01',
  endDate: '2026-06-30',
  regulation: 'R22' as string | null,
};

export function resolveAcademicRange(ay: ActiveAcademicYearSummary | null | undefined) {
  if (ay) {
    return {
      id: ay.id as string | null,
      name: ay.name,
      code: ay.code as string | null,
      startDate: ay.startDate,
      endDate: ay.endDate,
      regulation: ay.regulation,
    };
  }
  return { ...FALLBACK_ACADEMIC_RANGE };
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export type SemesterRange = {
  start: string;
  end: string;
  label: string;
  shortLabel: string;
  jumpYear: number;
  jumpMonth: number;
};

/** Derive odd/even semester windows from an academic year span (India-style Jul–Dec / Dec–Jun). */
export function buildSemesterRanges(startDate: string, endDate: string): {
  odd: SemesterRange;
  even: SemesterRange;
} {
  const startY = Number(startDate.slice(0, 4)) || new Date().getFullYear();
  const endY = Number(endDate.slice(0, 4)) || startY + 1;
  const startM = Number(startDate.slice(5, 7)) || 7;
  const endM = Number(endDate.slice(5, 7)) || 6;
  const oddEnd = `${startY}-12-15`;
  const evenStart = `${startY}-12-01`;

  return {
    odd: {
      start: startDate,
      end: oddEnd <= endDate ? oddEnd : endDate,
      label: 'I Sem (Odd)',
      shortLabel: `${MONTH_SHORT[startM - 1]}–Dec ${startY}`,
      jumpYear: startY,
      jumpMonth: Math.min(11, Math.max(0, startM)), // ~month after AY start (0-indexed)
    },
    even: {
      start: evenStart >= startDate ? evenStart : startDate,
      end: endDate,
      label: 'II Sem (Even)',
      shortLabel: `Dec ${startY}–${MONTH_SHORT[endM - 1]} ${endY}`,
      jumpYear: endY,
      jumpMonth: 1, // February of end year
    },
  };
}
