import { db } from '@/lib/db';
import type { ActiveAcademicYearSummary } from './academic-year-range';

export type { ActiveAcademicYearSummary };
export {
  FALLBACK_ACADEMIC_RANGE,
  resolveAcademicRange,
  buildSemesterRanges,
  type SemesterRange,
} from './academic-year-range';

export async function getActiveAcademicYear(): Promise<ActiveAcademicYearSummary | null> {
  return db.academicYear.findFirst({
    where: { status: 'active' },
    orderBy: { startDate: 'desc' },
    select: {
      id: true,
      name: true,
      code: true,
      startDate: true,
      endDate: true,
      regulation: true,
      status: true,
    },
  });
}
