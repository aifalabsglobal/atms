import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = {};
    if (courseId) where.courseId = courseId;
    if (status) where.status = status;

    const [assignments, total] = await Promise.all([
      db.assignment.findMany({
        where,
        include: {
          course: { select: { name: true, code: true } },
          _count: { select: { submissions: true } },
          submissions: {
            select: { score: true, status: true },
          },
        },
        orderBy: { dueDate: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.assignment.count({ where }),
    ]);

    // Calculate stats per assignment
    const assignmentsWithStats = assignments.map(a => {
      const gradedSubs = a.submissions.filter(s => s.status === 'graded');
      const avgScore = gradedSubs.length > 0
        ? Math.round(gradedSubs.reduce((s, sub) => s + (sub.score || 0), 0) / gradedSubs.length)
        : null;
      return {
        ...a,
        stats: { totalSubmissions: a._count.submissions, avgScore, gradedCount: gradedSubs.length },
      };
    });

    return NextResponse.json({ assignments: assignmentsWithStats, total, page, limit });
  } catch (error) {
    console.error('Assignments API error:', error);
    return NextResponse.json({ error: 'Failed to load assignments' }, { status: 500 });
  }
}
