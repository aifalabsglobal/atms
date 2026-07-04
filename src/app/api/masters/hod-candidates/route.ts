import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireMastersWrite } from '@/lib/masters-helpers';

export async function GET(request: Request) {
  try {
    const { error } = await requireMastersWrite();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');

    const where: Record<string, unknown> = {
      role: { in: ['hod', 'faculty'] },
      status: 'active',
    };
    if (departmentId) where.departmentId = departmentId;

    const candidates = await db.user.findMany({
      where,
      select: { id: true, name: true, email: true, role: true, department: true },
      orderBy: { name: 'asc' },
      take: 100,
    });

    return NextResponse.json({ candidates });
  } catch (err) {
    console.error('HOD candidates API error:', err);
    return NextResponse.json({ error: 'Failed to load HOD candidates' }, { status: 500 });
  }
}
