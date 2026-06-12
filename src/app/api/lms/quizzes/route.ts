import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const studentId = searchParams.get('studentId');
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
      attemptWhere.courseId = { in: enrolledCourseIds };
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

    return NextResponse.json({
      questions,
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
