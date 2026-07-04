const SUBJECT_CODE_PATTERN = /^[A-Z]{2,4}\d{3}[A-Z]{2,3}$/;

const VALID_CATEGORIES = ['BS', 'ES', 'PC', 'PE', 'OE', 'HS'] as const;

export function validateSubjectCode(code: string): string | null {
  const normalized = code.trim().toUpperCase();
  if (!SUBJECT_CODE_PATTERN.test(normalized)) {
    return 'Subject code must match JNTU pattern (e.g. CS301PC, MA101BS)';
  }
  return null;
}

export function validateSubjectLtp(params: {
  type: string;
  lectureHours: number;
  tutorialHours: number;
  labHours: number;
  credits: number;
}): string | null {
  const { type, lectureHours, tutorialHours, labHours, credits } = params;
  if (lectureHours < 0 || tutorialHours < 0 || labHours < 0) {
    return 'L-T-P hours cannot be negative';
  }
  if (type === 'lab' && labHours <= 0) {
    return 'Lab subjects must have lab hours > 0';
  }
  const expectedMin = Math.max(1, Math.ceil((lectureHours + tutorialHours + labHours) / 3));
  if (credits < expectedMin - 1 || credits > lectureHours + tutorialHours + labHours + 2) {
    return `Credits (${credits}) should align with L-T-P (${lectureHours}-${tutorialHours}-${labHours})`;
  }
  return null;
}

export function validateCategory(category: string | null | undefined): string | null {
  if (!category) return null;
  if (!VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
    return 'Invalid category. Use BS, ES, PC, PE, OE, or HS';
  }
  return null;
}

export function semesterCodeToNumber(code: string | null | undefined): number {
  const map: Record<string, number> = {
    'I-I': 1, 'I-II': 2, 'II-I': 3, 'II-II': 4,
    'III-I': 5, 'III-II': 6, 'IV-I': 7, 'IV-II': 8,
  };
  return code ? map[code] ?? 1 : 1;
}
