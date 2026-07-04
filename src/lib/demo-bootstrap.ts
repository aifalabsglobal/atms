import { db } from '@/lib/db';
import { BUNDLED_CODING_PROBLEMS } from '@/data/leetcode-problems';
import { parseCodingMeta } from '@/lib/coding-types';

export type DemoBootstrapResult = {
  coding: { created: number; skipped: number; total: number; errors: string[] };
  enrollmentsEnsured: number;
  ready: boolean;
};

export async function ensureDemoCodingProblems(): Promise<DemoBootstrapResult['coding']> {
  const result = { created: 0, skipped: 0, total: BUNDLED_CODING_PROBLEMS.length, errors: [] as string[] };

  for (const prob of BUNDLED_CODING_PROBLEMS) {
    try {
      const course = await db.course.findFirst({
        where: { code: prob.courseCode, isActive: true },
      });
      if (!course) {
        result.errors.push(`Course ${prob.courseCode} not found — run db:seed`);
        continue;
      }

      const existing = await db.quizQuestion.findMany({
        where: { courseId: course.id, type: 'coding' },
        select: { options: true },
      });

      const hasSlug = existing.some((q) => {
        const meta = parseCodingMeta(q.options);
        return meta?.slug === prob.meta.slug;
      });

      if (hasSlug) {
        result.skipped++;
        continue;
      }

      await db.quizQuestion.create({
        data: {
          courseId: course.id,
          question: prob.statement,
          type: 'coding',
          options: JSON.stringify(prob.meta),
          correctAnswer: null,
          points: prob.points,
          difficulty: prob.difficulty,
          explanation: `Demo problem: ${prob.meta.title}`,
        },
      });
      result.created++;
    } catch (e) {
      result.errors.push(`${prob.meta.slug}: ${e instanceof Error ? e.message : 'failed'}`);
    }
  }

  return result;
}

/** Ensure demo students can see coding problems (enrolled in problem courses). */
export async function ensureDemoCodingEnrollments(): Promise<number> {
  const courseCodes = [...new Set(BUNDLED_CODING_PROBLEMS.map((p) => p.courseCode))];
  const codingCourses = await db.course.findMany({
    where: { code: { in: courseCodes }, isActive: true },
    select: { id: true },
  });
  if (codingCourses.length === 0) return 0;

  const cseDept = await db.department.findFirst({ where: { code: 'CSE' }, select: { id: true } });
  const cseStudents = await db.user.findMany({
    where: {
      role: 'student',
      ...(cseDept ? { departmentId: cseDept.id } : { department: { contains: 'Computer Science' } }),
    },
    select: { id: true },
  });

  let created = 0;
  for (const student of cseStudents) {
    for (const course of codingCourses) {
      const existing = await db.courseEnrollment.findUnique({
        where: { courseId_studentId: { courseId: course.id, studentId: student.id } },
      });
      if (!existing) {
        await db.courseEnrollment.create({
          data: { courseId: course.id, studentId: student.id, status: 'enrolled' },
        });
        created++;
      } else if (existing.status !== 'enrolled') {
        await db.courseEnrollment.update({
          where: { id: existing.id },
          data: { status: 'enrolled' },
        });
      }
    }
  }
  return created;
}

export async function getDemoReadiness(): Promise<DemoBootstrapResult> {
  const codingCount = await db.quizQuestion.count({ where: { type: 'coding' } });
  const courseCount = await db.course.count({ where: { isActive: true } });
  const enrollmentCount = await db.courseEnrollment.count({ where: { status: 'enrolled' } });

  return {
    coding: {
      created: 0,
      skipped: codingCount,
      total: BUNDLED_CODING_PROBLEMS.length,
      errors: [],
    },
    enrollmentsEnsured: 0,
    ready: codingCount >= 2 && courseCount > 0 && enrollmentCount > 0,
  };
}

export async function runDemoBootstrap(): Promise<DemoBootstrapResult> {
  const coding = await ensureDemoCodingProblems();
  const enrollmentsEnsured = await ensureDemoCodingEnrollments();
  const codingCount = await db.quizQuestion.count({ where: { type: 'coding' } });
  const courseCount = await db.course.count({ where: { isActive: true } });
  const enrollmentCount = await db.courseEnrollment.count({ where: { status: 'enrolled' } });

  return {
    coding,
    enrollmentsEnsured,
    ready: codingCount >= 2 && courseCount > 0 && enrollmentCount > 0,
  };
}
