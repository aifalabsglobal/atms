import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import {
  requireUserManagement,
  getCampusScope,
} from '@/lib/auth-helpers';
import type { Role } from '@/lib/store';
import { logAudit, getClientIp } from '@/lib/audit';
import { enforceRateLimit } from '@/lib/rate-limit';
import { sendWelcomeEmail } from '@/lib/email';
import { maybeProvisionWalletOnCreate } from '@/lib/knuct';
import {
  ALL_ROLES,
  STAFF_ROLES,
  canAssignRole,
  generateTempPassword,
} from '@/lib/user-management';

export async function GET(request: Request) {
  try {
    const { error, session } = await requireUserManagement();
    if (error || !session) return error;

    const scope = await getCampusScope(session);
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const department = searchParams.get('department');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: Record<string, unknown> = {};
    if (category === 'staff') {
      where.role = role && STAFF_ROLES.includes(role as Role)
        ? role
        : { in: STAFF_ROLES };
    } else if (category === 'campus') {
      where.role = role && !STAFF_ROLES.includes(role as Role)
        ? role
        : { notIn: STAFF_ROLES };
    } else if (role) {
      where.role = role;
    }
    if (status) where.status = status;
    if (department) where.department = department;
    if (search) where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
      { employeeId: { contains: search } },
    ];

    if (scope.level === 'department') {
      where.departmentId = scope.departmentId;
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true, email: true, name: true, employeeId: true, department: true, phone: true, role: true, status: true, avatarUrl: true, lastLoginAt: true, createdAt: true,
          knuctWallet: { select: { did: true, status: true } },
          _count: { select: { attendanceRecords: true, courseEnrollments: true, submissions: true, taughtCourses: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.user.count({ where }),
    ]);

    const roleDistWhere: Record<string, unknown> =
      scope.level === 'department' ? { departmentId: scope.departmentId } : {};
    if (category === 'staff') {
      roleDistWhere.role = { in: STAFF_ROLES };
    } else if (category === 'campus') {
      roleDistWhere.role = { notIn: STAFF_ROLES };
    }
    const [roleDistribution, departmentGroups] = await Promise.all([
      db.user.groupBy({ by: ['role'], where: roleDistWhere, _count: true }),
      db.user.groupBy({
        by: ['department'],
        where: { ...roleDistWhere, department: { not: null } },
        _count: true,
      }),
    ]);

    const departments = departmentGroups
      .map((g) => g.department)
      .filter((d): d is string => !!d)
      .sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ users, total, page, limit, roleDistribution, departments });
  } catch (error) {
    console.error('Users API error:', error);
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit(`users-create:${getClientIp(request) ?? 'anon'}`, 20, 60_000);
    if (limited) return limited;

    const { error, session } = await requireUserManagement();
    if (error || !session) return error;

    const actorRole = session.user.role as Role;
    const scope = await getCampusScope(session);
    const body = await request.json();
    const { email, name, role, department, departmentId, phone, employeeId, password } = body;

    if (!email?.trim() || !name?.trim() || !role) {
      return NextResponse.json({ error: 'email, name, and role are required' }, { status: 400 });
    }

    if (!ALL_ROLES.includes(role as Role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    if (!canAssignRole(actorRole, role as Role)) {
      return NextResponse.json({ error: 'You cannot assign this role' }, { status: 403 });
    }

    const existing = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    let resolvedDeptId = departmentId ?? null;
    let resolvedDept = department ?? null;

    if (scope.level === 'department') {
      resolvedDeptId = scope.departmentId;
      const dept = await db.department.findUnique({
        where: { id: scope.departmentId },
        select: { name: true },
      });
      resolvedDept = dept?.name ?? resolvedDept;
    } else if (resolvedDeptId && !resolvedDept) {
      const dept = await db.department.findUnique({
        where: { id: resolvedDeptId },
        select: { name: true },
      });
      resolvedDept = dept?.name ?? null;
    }

    const tempPassword = password?.trim() || generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await db.user.create({
      data: {
        email: email.trim().toLowerCase(),
        name: name.trim(),
        role,
        department: resolvedDept,
        departmentId: resolvedDeptId,
        phone: phone?.trim() || null,
        employeeId: employeeId?.trim() || null,
        passwordHash,
        status: 'active',
      },
      select: {
        id: true, email: true, name: true, role: true, department: true, status: true, employeeId: true, createdAt: true,
      },
    });

    await logAudit({
      userId: session.user.id,
      action: 'user.create',
      resource: `user:${user.id}`,
      details: { email: user.email, role: user.role },
      ipAddress: getClientIp(request),
    });

    if (!password?.trim()) {
      sendWelcomeEmail(user.email, user.name, tempPassword).catch((err) =>
        console.warn('[email] welcome failed:', err)
      );
    }

    maybeProvisionWalletOnCreate(user.id);

    return NextResponse.json(
      { user, tempPassword: password?.trim() ? undefined : tempPassword },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
