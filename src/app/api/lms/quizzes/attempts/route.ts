import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAuth, resolveStudentId } from '@/lib/auth-helpers';
import { auditLms } from '@/lib/lms-helpers';

export async function POST(request: Request) {
  try {
    const { error, session } = await requireAuth();
    if (error || !session) return error;

    const { studentId, error: studentError } = await resolveStudentId(session, null);
    if (studentError) return studentError;
    if (!studentId || (session.user.role !== 'student' && session.user.role !== 'parent')) {
      return NextResponse.json({ error: 'Only students can submit quiz attempts' }, { status: 403 });
    }

    const body = await request.json();
    const { courseId, answers, timeTaken } = body as {
      courseId: string;
      answers: Record<string, string>;
      timeTaken?: number;
    };

    if (!courseId || !answers || typeof answers !== 'object') {
      return NextResponse.json({ error: 'courseId and answers are required' }, { status: 400 });
    }

    const enrolled = await db.courseEnrollment.findUnique({
      where: { courseId_studentId: { courseId, studentId } },
    });
    if (!enrolled || enrolled.status !== 'enrolled') {
      return NextResponse.json({ error: 'Not enrolled in this course' }, { status: 403 });
    }

    const questions = await db.quizQuestion.findMany({
      where: { courseId },
      orderBy: { createdAt: 'asc' },
    });
    if (questions.length === 0) {
      return NextResponse.json({ error: 'No quiz questions for this course' }, { status: 400 });
    }

    let score = 0;
    let totalPoints = 0;
    for (const q of questions) {
      totalPoints += q.points;
      const given = answers[q.id]?.trim();
      const expected = q.correctAnswer?.trim();
      if (given && expected && given.toLowerCase() === expected.toLowerCase()) {
        score += q.points;
      }
    }

    const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
    const now = new Date();

    const attempt = await db.quizAttempt.create({
      data: {
        studentId,
        courseId,
        questions: JSON.stringify(questions.map((q) => ({ id: q.id, question: q.question, points: q.points }))),
        answers: JSON.stringify(answers),
        score,
        totalPoints,
        percentage,
        timeTaken: timeTaken ?? null,
        status: 'completed',
        completedAt: now,
      },
      include: {
        course: { select: { name: true, code: true } },
        student: { select: { name: true } },
      },
    });

    const existingGrade = await db.gradeBook.findFirst({
      where: { courseId, studentId, component: 'quiz' },
    });
    if (existingGrade) {
      await db.gradeBook.update({
        where: { id: existingGrade.id },
        data: { score: percentage, maxScore: 100, gradedAt: now },
      });
    } else {
      await db.gradeBook.create({
        data: {
          courseId,
          studentId,
          component: 'quiz',
          score: percentage,
          maxScore: 100,
          weightage: 15,
        },
      });
    }

    await auditLms(request, session.user.id, 'lms.quiz.attempt', `attempt:${attempt.id}`, { courseId, percentage });

    return NextResponse.json({ attempt, score, totalPoints, percentage }, { status: 201 });
  } catch (err) {
    console.error('Quiz attempt error:', err);
    return NextResponse.json({ error: 'Failed to submit quiz' }, { status: 500 });
  }
}
