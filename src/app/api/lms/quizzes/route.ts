import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAuth, resolveStudentId, getCampusScope, buildCourseIdFilter, CAMPUS_READ_ROLES } from '@/lib/auth-helpers';
import type { Role } from '@/lib/store';
import { parseCodingMeta, sanitizeCodingMeta } from '@/lib/coding-types';

export async function GET(request: Request) {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const { studentId, error: studentError } = await resolveStudentId(session!, searchParams.get('studentId'));
    if (studentError) return studentError;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Build where clause for questions
    const where: Record<string, unknown> = {};
    if (courseId) where.courseId = courseId;

    // If studentId provided, filter to only their enrolled courses
    let enrolledCourseIds: string[] | null = null;
    if (studentId) {
      const enrollments = await db.courseEnrollment.findMany({
        where: { studentId, status: 'enrolled' },
        select: { courseId: true },
      });
      enrolledCourseIds = enrollments.map(e => e.courseId);
      where.courseId = courseId
        ? (enrolledCourseIds.includes(courseId) ? courseId : '__none__')
        : { in: enrolledCourseIds };
    } else if (CAMPUS_READ_ROLES.includes(session!.user.role as Role)) {
      const scope = await getCampusScope(session!);
      const filter = buildCourseIdFilter(scope, courseId);
      if (filter) where.courseId = filter;
      enrolledCourseIds = scope.level === 'all' ? null : scope.courseIds;
    }

    const [questions, total] = await Promise.all([
      db.quizQuestion.findMany({
        where,
        include: { course: { select: { name: true, code: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.quizQuestion.count({ where }),
    ]);

    // Fetch attempts - filter by studentId if provided, or by enrolled courses
    const attemptWhere: Record<string, unknown> = {};
    if (studentId) {
      attemptWhere.studentId = studentId;
    }
    if (courseId) {
      attemptWhere.courseId = courseId;
    } else if (enrolledCourseIds) {
      attemptWhere.courseId = { in: enrolledCourseIds.length > 0 ? enrolledCourseIds : ['__none__'] };
    }

    const attempts = await db.quizAttempt.findMany({
      where: attemptWhere,
      include: {
        student: { select: { name: true, employeeId: true } },
        course: { select: { name: true, code: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });

    // Calculate summary stats
    const totalQuestions = total;
    const courseWiseQuestions = questions.reduce((acc, q) => {
      const key = q.courseId;
      if (!acc[key]) acc[key] = { courseId: key, courseCode: q.course.code, courseName: q.course.name, count: 0 };
      acc[key].count++;
      return acc;
    }, {} as Record<string, { courseId: string; courseCode: string; courseName: string; count: number }>);

    const myAttempts = studentId ? attempts.filter(a => a.studentId === studentId) : attempts;
    const avgScore = myAttempts.length > 0
      ? Math.round(myAttempts.reduce((s, a) => s + a.percentage, 0) / myAttempts.length)
      : 0;
    const bestScore = myAttempts.length > 0 ? Math.max(...myAttempts.map(a => a.percentage)) : 0;

    const role = session!.user.role as Role;
    const isStudent = role === 'student' || role === 'parent';

    return NextResponse.json({
      questions: questions.map((q) => {
        let options = q.options;
        if (isStudent && q.type === 'coding' && options) {
          const meta = parseCodingMeta(options);
          if (meta) options = JSON.stringify(sanitizeCodingMeta(meta));
        }
        const codingMeta = q.type === 'coding' ? parseCodingMeta(options) : null;
        return {
          ...q,
          correctAnswer: isStudent ? undefined : q.correctAnswer,
          options,
          codingMeta: codingMeta
            ? (isStudent ? sanitizeCodingMeta(codingMeta) : codingMeta)
            : null,
        };
      }),
      attempts,
      total,
      page,
      limit,
      summary: {
        totalQuestions,
        totalAttempts: myAttempts.length,
        avgScore,
        bestScore,
        courseBreakdown: Object.values(courseWiseQuestions),
      },
    });
  } catch (error) {
    console.error('Quizzes API error:', error);
    return NextResponse.json({ error: 'Failed to load quizzes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { requireLmsWrite, assertInstructorOwnsCourse, auditLms } = await import('@/lib/lms-helpers');
    const { error, session } = await requireLmsWrite();
    if (error || !session) return error;

    const body = await request.json();
    const { courseId, question, type, options, correctAnswer, points, difficulty, explanation, codingMeta } = body;

    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required' }, { status: 400 });
    }

    const isCoding = type === 'coding';
    if (!question?.trim() && !codingMeta?.title) {
      return NextResponse.json({ error: 'question or codingMeta.title is required' }, { status: 400 });
    }
    if (!isCoding && !correctAnswer?.trim()) {
      return NextResponse.json({ error: 'correctAnswer is required for non-coding questions' }, { status: 400 });
    }
    if (isCoding && !codingMeta?.functionName) {
      return NextResponse.json({ error: 'codingMeta with functionName and testCases is required' }, { status: 400 });
    }

    const scopeErr = await assertInstructorOwnsCourse(session, courseId);
    if (scopeErr) return scopeErr;

    const serializedMeta = isCoding ? JSON.stringify(codingMeta) : options
      ? (typeof options === 'string' ? options : JSON.stringify(options))
      : null;

    const q = await db.quizQuestion.create({
      data: {
        courseId,
        question: isCoding ? (question?.trim() || codingMeta.title) : question.trim(),
        type: type || 'mcq',
        options: serializedMeta,
        correctAnswer: isCoding ? null : correctAnswer.trim(),
        points: points ?? (isCoding ? 10 : 1),
        difficulty: difficulty || 'medium',
        explanation: explanation || null,
      },
      include: { course: { select: { name: true, code: true } } },
    });

    await auditLms(request, session.user.id, 'lms.quiz.create', `question:${q.id}`, { courseId });

    return NextResponse.json({ question: q }, { status: 201 });
  } catch (error) {
    console.error('Create quiz error:', error);
    return NextResponse.json({ error: 'Failed to create question' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { requireLmsWrite, auditLms } = await import('@/lib/lms-helpers');
    const { assertInstructorOwnsCourse } = await import('@/lib/lms-helpers');
    const { error, session } = await requireLmsWrite();
    if (error || !session) return error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const existing = await db.quizQuestion.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Question not found' }, { status: 404 });

    const scopeErr = await assertInstructorOwnsCourse(session, existing.courseId);
    if (scopeErr) return scopeErr;

    const body = await request.json();
    const { question, type, options, correctAnswer, points, difficulty, explanation, codingMeta } = body;

    const isCoding = existing.type === 'coding' || type === 'coding';
    const serializedOptions =
      codingMeta !== undefined
        ? JSON.stringify(codingMeta)
        : options !== undefined
          ? (typeof options === 'string' ? options : JSON.stringify(options))
          : undefined;

    const q = await db.quizQuestion.update({
      where: { id },
      data: {
        ...(question !== undefined && { question: question.trim() }),
        ...(type !== undefined && { type }),
        ...(serializedOptions !== undefined && { options: serializedOptions }),
        ...(correctAnswer !== undefined && { correctAnswer: isCoding ? null : correctAnswer.trim() }),
        ...(points !== undefined && { points }),
        ...(difficulty !== undefined && { difficulty }),
        ...(explanation !== undefined && { explanation }),
      },
      include: { course: { select: { name: true, code: true } } },
    });

    await auditLms(request, session.user.id, 'lms.quiz.update', `question:${id}`, {});

    return NextResponse.json({ question: q });
  } catch (error) {
    console.error('Update quiz error:', error);
    return NextResponse.json({ error: 'Failed to update question' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { requireLmsWrite, assertInstructorOwnsCourse, auditLms } = await import('@/lib/lms-helpers');
    const { error, session } = await requireLmsWrite();
    if (error || !session) return error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const existing = await db.quizQuestion.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Question not found' }, { status: 404 });

    const scopeErr = await assertInstructorOwnsCourse(session, existing.courseId);
    if (scopeErr) return scopeErr;

    await db.quizQuestion.delete({ where: { id } });
    await auditLms(request, session.user.id, 'lms.quiz.delete', `question:${id}`, {});

    return NextResponse.json({ message: 'Question deleted' });
  } catch (error) {
    console.error('Delete quiz error:', error);
    return NextResponse.json({ error: 'Failed to delete question' }, { status: 500 });
  }
}
