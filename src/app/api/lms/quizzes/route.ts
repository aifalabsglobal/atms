import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = {};
    if (courseId) where.courseId = courseId;

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

    const attempts = await db.quizAttempt.findMany({
      where: courseId ? { courseId } : undefined,
      include: { student: { select: { name: true, employeeId: true } }, course: { select: { name: true, code: true } } },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({ questions, attempts, total, page, limit });
  } catch (error) {
    console.error('Quizzes API error:', error);
    return NextResponse.json({ error: 'Failed to load quizzes' }, { status: 500 });
  }
}
