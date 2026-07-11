import { db } from '@/lib/db';
import { getOrgSettings } from '@/lib/settings/org-config';

export type GateResult = { ok: true } | { ok: false; error: string; status: number };

/** Subject (or slot) semester must exist and belong to an active academic year. */
export async function assertSemesterUnderActiveYear(
  semesterId: string | null | undefined,
): Promise<GateResult> {
  if (!semesterId) {
    return {
      ok: false,
      error: 'A semester linked to the active academic year is required (Organization settings).',
      status: 400,
    };
  }

  const semester = await db.semester.findUnique({
    where: { id: semesterId },
    select: {
      id: true,
      code: true,
      academicYear: { select: { id: true, name: true, status: true } },
    },
  });

  if (!semester) {
    return { ok: false, error: 'Semester not found', status: 404 };
  }

  if (semester.academicYear.status !== 'active') {
    return {
      ok: false,
      error: `Semester ${semester.code} belongs to academic year “${semester.academicYear.name}” which is not Active. Link a semester under the active year.`,
      status: 400,
    };
  }

  return { ok: true };
}

/** Shared publish gates: active year + optional semester-under-active. */
export async function assertSubjectPublishGates(subjectId: string): Promise<GateResult> {
  const org = await getOrgSettings();

  if (org.requireActiveAcademicYear) {
    const activeYear = await db.academicYear.findFirst({
      where: { status: 'active' },
      select: { id: true },
    });
    if (!activeYear) {
      return {
        ok: false,
        error:
          'An active academic year is required before publishing subjects. Set one in Masters → Academic Years.',
        status: 400,
      };
    }
  }

  if (org.requireSemesterForPublish) {
    const subject = await db.subject.findUnique({
      where: { id: subjectId },
      select: { id: true, code: true, semesterId: true },
    });
    if (!subject) {
      return { ok: false, error: 'Subject not found', status: 404 };
    }
    const semGate = await assertSemesterUnderActiveYear(subject.semesterId);
    if (!semGate.ok) {
      return {
        ok: false,
        error: `${subject.code}: ${semGate.error}`,
        status: semGate.status,
      };
    }
  }

  return { ok: true };
}
