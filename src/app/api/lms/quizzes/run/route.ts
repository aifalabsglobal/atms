import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveStudentId } from '@/lib/auth-helpers';
import { requireLmsRead } from '@/lib/lms-helpers';
import { judgeSubmission } from '@/lib/coding-judge';
import { parseCodingMeta } from '@/lib/coding-types';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/audit';
import { getLmsSettings } from '@/lib/settings/lms-config';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { error, session } = await requireLmsRead();
    if (error || !session) return error;

    const lms = await getLmsSettings();
    if (!lms.codingEnabled) {
      return NextResponse.json({ error: 'Coding quizzes are disabled by administration' }, { status: 403 });
    }

    const limited = await enforceRateLimit(
      `coding-run:${session.user.id}:${getClientIp(request) ?? 'anon'}`,
      lms.codingRunRateLimitPerMin,
      60_000
    );
    if (limited) return limited;

    const body = await request.json();
    const { questionId, code, language = 'javascript' } = body as {
      questionId: string;
      code: string;
      language?: string;
    };

    if (!questionId || !code?.trim()) {
      return NextResponse.json({ error: 'questionId and code are required' }, { status: 400 });
    }

    if (language === 'python' && !lms.codingPythonEnabled) {
      return NextResponse.json({ error: 'Python judging is disabled by administration' }, { status: 400 });
    }

    const question = await db.quizQuestion.findUnique({ where: { id: questionId } });
    if (!question || question.type !== 'coding') {
      return NextResponse.json({ error: 'Coding problem not found' }, { status: 404 });
    }

    const meta = parseCodingMeta(question.options);
    if (!meta) {
      return NextResponse.json({ error: 'Invalid problem configuration' }, { status: 500 });
    }

    const { studentId, error: studentError } = await resolveStudentId(session, null);
    if (studentError) return studentError;
    if (studentId) {
      const enrolled = await db.courseEnrollment.findUnique({
        where: { courseId_studentId: { courseId: question.courseId, studentId } },
      });
      if (!enrolled || enrolled.status !== 'enrolled') {
        return NextResponse.json({ error: 'Not enrolled in this course' }, { status: 403 });
      }
    }

    const result = judgeSubmission(code, meta, { sampleOnly: true, language });

    return NextResponse.json({
      ...result,
      status: result.allPassed ? 'Accepted' : 'Wrong Answer',
    });
  } catch (err) {
    console.error('Code run error:', err);
    return NextResponse.json({ error: 'Failed to run code' }, { status: 500 });
  }
}
