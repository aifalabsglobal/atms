import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireLmsRead, assertInstructorOwnsCourse } from '@/lib/lms-helpers';
import { resolveStudentId } from '@/lib/auth-helpers';

export async function GET(request: Request) {
  try {
    const { error, session } = await requireLmsRead();
    if (error || !session) return error;

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required' }, { status: 400 });
    }

    const { studentId, error: studentError } = await resolveStudentId(session, searchParams.get('studentId'));
    if (studentError) return studentError;

    if (studentId) {
      const enrolled = await db.courseEnrollment.findUnique({
        where: { courseId_studentId: { courseId, studentId } },
      });
      if (!enrolled || enrolled.status !== 'enrolled') {
        return NextResponse.json({ error: 'Not enrolled in this course' }, { status: 403 });
      }
    } else {
      const scopeErr = await assertInstructorOwnsCourse(session, courseId);
      if (scopeErr) return scopeErr;
    }

    const course = await db.course.findUnique({
      where: { id: courseId },
      select: { id: true, code: true, name: true, instructor: { select: { name: true } } },
    });
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    const enrollmentWhere: Record<string, unknown> = { courseId, status: 'enrolled' };
    if (studentId) enrollmentWhere.studentId = studentId;

    const enrollments = await db.courseEnrollment.findMany({
      where: enrollmentWhere,
      include: {
        student: { select: { id: true, name: true, email: true, employeeId: true } },
      },
      orderBy: { student: { name: 'asc' } },
    });

    const studentIds = enrollments.map((e) => e.studentId);
    const [grades, quizAttempts] = await Promise.all([
      db.gradeBook.findMany({
        where: { courseId, studentId: { in: studentIds.length ? studentIds : ['__none__'] } },
        orderBy: { gradedAt: 'desc' },
      }),
      db.quizAttempt.findMany({
        where: { courseId, studentId: { in: studentIds.length ? studentIds : ['__none__'] }, status: 'completed' },
        select: { studentId: true, percentage: true, score: true, totalPoints: true },
      }),
    ]);

    const rows = enrollments.map((e) => {
      const studentGrades = grades.filter((g) => g.studentId === e.studentId);
      const attempts = quizAttempts.filter((a) => a.studentId === e.studentId);
      const weighted = studentGrades.reduce((sum, g) => {
        const pct = g.maxScore > 0 ? (g.score / g.maxScore) * 100 : 0;
        return sum + pct * (g.weightage / 100);
      }, 0);
      const totalWeight = studentGrades.reduce((s, g) => s + g.weightage, 0);
      const overallPct = totalWeight > 0 ? Math.round(weighted / (totalWeight / 100)) : null;
      const bestQuiz = attempts.length
        ? Math.max(...attempts.map((a) => a.percentage))
        : null;

      return {
        student: e.student,
        components: studentGrades.map((g) => ({
          id: g.id,
          component: g.component,
          componentId: g.componentId,
          score: g.score,
          maxScore: g.maxScore,
          weightage: g.weightage,
          pct: g.maxScore > 0 ? Math.round((g.score / g.maxScore) * 100) : 0,
        })),
        bestQuizPct: bestQuiz !== null ? Math.round(bestQuiz) : null,
        overallPct,
      };
    });

    return NextResponse.json({ course, gradebook: rows, total: rows.length });
  } catch (err) {
    console.error('Gradebook error:', err);
    return NextResponse.json({ error: 'Failed to load gradebook' }, { status: 500 });
  }
}
