import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('programId');
    const type = searchParams.get('type');
    const instructorId = searchParams.get('instructorId');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = { isActive: true };
    if (programId) where.programId = programId;
    if (type) where.type = type;
    if (instructorId) where.instructorId = instructorId;
    if (search) where.OR = [
      { name: { contains: search } },
      { code: { contains: search } },
    ];

    const [courses, total] = await Promise.all([
      db.course.findMany({
        where,
        include: {
          program: { select: { name: true, code: true } },
          instructor: { select: { name: true, email: true } },
          _count: { select: { enrollments: true, modules: true, assignments: true, attendanceSessions: true } },
          modules: { include: { _count: { select: { lessons: true } } }, orderBy: { orderIndex: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.course.count({ where }),
    ]);

    return NextResponse.json({ courses, total, page, limit });
  } catch (error) {
    console.error('Courses API error:', error);
    return NextResponse.json({ error: 'Failed to load courses' }, { status: 500 });
  }
}
