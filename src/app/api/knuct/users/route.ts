import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireKnuctOpsAccess } from '@/lib/auth-helpers';
import { STAFF_ROLES } from '@/lib/user-management';
import type { Role } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Knuct-ops user picker (credentials / provision targets) — no campus Users RBAC. */
export async function GET(request: Request) {
  try {
    const { error, session } = await requireKnuctOpsAccess();
    if (error || !session) return error;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();
    const category = searchParams.get('category');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10) || 100, 200);

    const where: Record<string, unknown> = { status: 'active' };
    if (category === 'campus') {
      where.role = { in: ['student', 'parent', 'visitor'] };
    } else if (category === 'staff') {
      where.role = { in: STAFF_ROLES };
    } else if (searchParams.get('role')) {
      where.role = searchParams.get('role') as Role;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const users = await db.user.findMany({
      where,
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
      take: limit,
    });

    return NextResponse.json({ users, total: users.length });
  } catch (err) {
    console.error('[knuct/users] GET error:', err);
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 });
  }
}
