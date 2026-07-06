import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveStudentId } from '@/lib/auth-helpers';
import { requireLmsRead, auditLms } from '@/lib/lms-helpers';
import { judgeSubmission } from '@/lib/coding-judge';
import { parseCodingMeta } from '@/lib/coding-types';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/audit';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { error, session } = await requireLmsRead();
    if (error || !session) return error;

    const limited = await enforceRateLimit(
      `coding-submit:${session.user.id}:${getClientIp(request) ?? 'anon'}`,
      15,
      60_000
    );
    if (limited) return limited;

    const { studentId, error: studentError } = await resolveStudentId(session, null);
    if (studentError) return studentError;
    if (!studentId || (session.user.role !== 'student' && session.user.role !== 'parent')) {
      return NextResponse.json({ error: 'Only students can submit solutions' }, { status: 403 });
    }

    const body = await request.json();
    const { questionId, code, language = 'javascript', timeTaken } = body as {
      questionId: string;
      code: string;
      language?: string;
      timeTaken?: number;
    };

    if (!questionId || !code?.trim()) {
      return NextResponse.json({ error: 'questionId and code are required' }, { status: 400 });
    }

    const question = await db.quizQuestion.findUnique({
      where: { id: questionId },
      include: { course: { select: { code: true, name: true } } },
    });
    if (!question || question.type !== 'coding') {
      return NextResponse.json({ error: 'Coding problem not found' }, { status: 404 });
    }

    const meta = parseCodingMeta(question.options);
    if (!meta) {
      return NextResponse.json({ error: 'Invalid problem configuration' }, { status: 500 });
    }

    const enrolled = await db.courseEnrollment.findUnique({
      where: { courseId_studentId: { courseId: question.courseId, studentId } },
    });
    if (!enrolled || enrolled.status !== 'enrolled') {
      return NextResponse.json({ error: 'Not enrolled in this course' }, { status: 403 });
    }

    const judge = judgeSubmission(code, meta, { sampleOnly: false, language });
    const score = judge.allPassed ? question.points : Math.round((judge.passed / judge.total) * question.points * 100) / 100;
    const percentage = judge.total > 0 ? Math.round((judge.passed / judge.total) * 100) : 0;
    const now = new Date();

    const attempt = await db.quizAttempt.create({
      data: {
        studentId,
        courseId: question.courseId,
        questions: JSON.stringify([{ id: question.id, title: meta.title, slug: meta.slug }]),
        answers: JSON.stringify({
          questionId,
          code,
          language,
          judge,
          status: judge.allPassed ? 'Accepted' : 'Wrong Answer',
        }),
        score,
        totalPoints: question.points,
        percentage,
        timeTaken: timeTaken ?? judge.totalRuntimeMs,
        status: judge.allPassed ? 'completed' : 'completed',
        completedAt: now,
      },
      include: {
        course: { select: { name: true, code: true } },
        student: { select: { name: true } },
      },
    });

    if (judge.allPassed) {
      const existingGrade = await db.gradeBook.findFirst({
        where: { courseId: question.courseId, studentId, component: 'quiz', componentId: question.id },
      });
      if (existingGrade) {
        await db.gradeBook.update({
          where: { id: existingGrade.id },
          data: { score: percentage, maxScore: 100, gradedAt: now },
        });
      } else {
        await db.gradeBook.create({
          data: {
            courseId: question.courseId,
            studentId,
            component: 'quiz',
            componentId: question.id,
            score: percentage,
            maxScore: 100,
            weightage: 15,
          },
        });
      }
    }

    await auditLms(request, session.user.id, 'lms.coding.submit', `attempt:${attempt.id}`, {
      questionId,
      slug: meta.slug,
      passed: judge.passed,
      total: judge.total,
    });

    return NextResponse.json({
      attempt,
      judge,
      score,
      totalPoints: question.points,
      percentage,
      status: judge.allPassed ? 'Accepted' : judge.passed > 0 ? 'Partially Accepted' : 'Wrong Answer',
    }, { status: 201 });
  } catch (err) {
    console.error('Code submit error:', err);
    return NextResponse.json({ error: 'Failed to submit solution' }, { status: 500 });
  }
}
