import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const reviewStatus = searchParams.get('reviewStatus');
    const severity = searchParams.get('severity');
    const type = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = {};
    if (reviewStatus) where.reviewStatus = reviewStatus;
    if (severity) where.severity = severity;
    if (type) where.type = type;

    const [violations, total] = await Promise.all([
      db.attendanceViolation.findMany({
        where,
        include: {
          violator: { select: { name: true, email: true, department: true, employeeId: true } },
          reviewer: { select: { name: true } },
          record: { select: { status: true, captureMethod: true, session: { select: { sessionDate: true, course: { select: { name: true, code: true } } } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.attendanceViolation.count({ where }),
    ]);

    return NextResponse.json({ violations, total, page, limit });
  } catch (error) {
    console.error('Violations API error:', error);
    return NextResponse.json({ error: 'Failed to load violations' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, reviewStatus, reviewNotes, reviewedBy } = body;

    const violation = await db.attendanceViolation.update({
      where: { id },
      data: { reviewStatus, reviewNotes, reviewedBy },
      include: { violator: { select: { name: true } } },
    });

    return NextResponse.json(violation);
  } catch (error) {
    console.error('Update violation error:', error);
    return NextResponse.json({ error: 'Failed to update violation' }, { status: 500 });
  }
}
