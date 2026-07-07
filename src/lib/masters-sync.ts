import { db } from '@/lib/db';
import { semesterCodeToNumber } from '@/lib/masters-validation';

type SubjectWithSemester = {
  id: string;
  code: string;
  name: string;
  credits: number;
  type: string;
  category: string | null;
  syllabus: string | null;
  isActive: boolean;
  semester: { code: string } | null;
};

export function buildCoursePayloadFromSubject(subject: SubjectWithSemester) {
  return {
    code: subject.code,
    name: subject.name,
    credits: subject.credits,
    semester: semesterCodeToNumber(subject.semester?.code),
    type: subject.type,
    syllabus: subject.syllabus,
    description: `${subject.name} — ${subject.category || 'PC'} (AIMSCS R22)`,
    isActive: subject.isActive,
  };
}

/** Sync all LMS courses linked to a masters subject after subject edit. */
export async function syncLinkedCourses(subjectId: string): Promise<{ synced: number; courseIds: string[] }> {
  const subject = await db.subject.findUnique({
    where: { id: subjectId },
    include: {
      semester: { select: { code: true } },
      courses: { select: { id: true, code: true } },
    },
  });

  if (!subject || subject.courses.length === 0) {
    return { synced: 0, courseIds: [] };
  }

  const payload = buildCoursePayloadFromSubject(subject);

  // If code changed, ensure no other course already owns the new code
  const codeConflict = await db.course.findFirst({
    where: {
      code: payload.code,
      subjectId: { not: subjectId },
    },
  });
  if (codeConflict) {
    throw new Error(`Cannot sync: course code ${payload.code} is already used by another course`);
  }

  const courseIds: string[] = [];
  for (const course of subject.courses) {
    await db.course.update({
      where: { id: course.id },
      data: payload,
    });
    courseIds.push(course.id);
  }

  return { synced: subject.courses.length, courseIds };
}

/** Publish or update a single LMS course from a masters subject. */
export async function publishSubjectToLms(
  subjectId: string,
  programId: string,
  instructorId?: string | null
) {
  const subject = await db.subject.findUnique({
    where: { id: subjectId },
    include: { semester: { select: { code: true } }, department: true },
  });
  if (!subject) throw new Error('Subject not found');

  const program = await db.program.findUnique({ where: { id: programId } });
  if (!program) throw new Error('Program not found');
  if (program.departmentId !== subject.departmentId) {
    throw new Error('Program must belong to the same department as the subject');
  }

  const existing = await db.course.findFirst({
    where: { OR: [{ subjectId }, { code: subject.code }] },
  });

  const courseData = {
    programId,
    subjectId: subject.id,
    ...buildCoursePayloadFromSubject(subject),
    instructorId: instructorId || null,
  };

  const course = existing
    ? await db.course.update({ where: { id: existing.id }, data: courseData })
    : await db.course.create({ data: courseData });

  return { course, created: !existing };
}
