import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireLmsWrite } from '@/lib/lms-helpers';

/** Programs available when creating an LMS course (faculty/admin with LMS write). */
export async function GET(request: Request) {
  try {
    const { error, session } = await requireLmsWrite();
    if (error || !session) return error;

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    const programs = await db.program.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        departmentId: true,
        department: { select: { id: true, name: true, code: true } },
      },
      orderBy: { code: 'asc' },
      take: limit,
    });

    return NextResponse.json({ programs, total: programs.length });
  } catch (err) {
    console.error('LMS programs picker error:', err);
    return NextResponse.json({ error: 'Failed to load programs' }, { status: 500 });
  }
}
