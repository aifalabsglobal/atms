import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const status = searchParams.get('status');
    const department = searchParams.get('department');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: Record<string, unknown> = {};
    if (role) where.role = role;
    if (status) where.status = status;
    if (department) where.department = department;
    if (search) where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
      { employeeId: { contains: search } },
    ];

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true, email: true, name: true, employeeId: true, department: true, phone: true, role: true, status: true, avatarUrl: true, lastLoginAt: true, createdAt: true,
          _count: { select: { attendanceRecords: true, courseEnrollments: true, submissions: true, taughtCourses: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.user.count({ where }),
    ]);

    // Role distribution
    const roleDistribution = await db.user.groupBy({ by: ['role'], _count: true });

    return NextResponse.json({ users, total, page, limit, roleDistribution });
  } catch (error) {
    console.error('Users API error:', error);
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 });
  }
}
