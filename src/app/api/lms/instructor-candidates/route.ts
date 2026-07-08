import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { ADMIN_ROLES } from '@/lib/auth-helpers';
import type { Role } from '@/lib/store';
import { requireLmsWrite } from '@/lib/lms-helpers';

/** Active faculty / lab assistants eligible to instruct an LMS course. */
export async function GET(request: Request) {
  try {
    const { error, session } = await requireLmsWrite();
    if (error || !session) return error;

    const role = session.user.role as Role;
    if (!ADMIN_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Only admins can assign instructors' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');
    const search = searchParams.get('search')?.trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200);

    const where: Record<string, unknown> = {
      role: { in: ['faculty', 'lab_assistant'] },
      status: 'active',
    };
    if (departmentId) where.departmentId = departmentId;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { employeeId: { contains: search } },
      ];
    }

    const candidates = await db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        employeeId: true,
      },
      orderBy: { name: 'asc' },
      take: limit,
    });

    return NextResponse.json({ candidates, total: candidates.length });
  } catch (err) {
    console.error('Instructor candidates error:', err);
    return NextResponse.json({ error: 'Failed to load instructor candidates' }, { status: 500 });
  }
}
