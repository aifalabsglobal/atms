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
import { sendPasswordResetEmail } from '@/lib/email';
import {
  ALL_ROLES,
  canAssignRole,
  generateTempPassword,
} from '@/lib/user-management';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const limited = await enforceRateLimit(`users-update:${getClientIp(request) ?? 'anon'}`, 30, 60_000);
    if (limited) return limited;

    const { error, session } = await requireUserManagement();
    if (error || !session) return error;

    const { id } = await context.params;
    const actorRole = session.user.role as Role;
    const scope = await getCampusScope(session);
    const body = await request.json();

    const target = await db.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true, departmentId: true, status: true },
    });

    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (scope.level === 'department' && target.departmentId !== scope.departmentId) {
      return NextResponse.json({ error: 'User is outside your department scope' }, { status: 403 });
    }

    if (!canAssignRole(actorRole, target.role as Role)) {
      return NextResponse.json({ error: 'You cannot manage this user' }, { status: 403 });
    }

    const data: Record<string, unknown> = {};
    let tempPassword: string | undefined;

    if (body.name?.trim()) data.name = body.name.trim();
    if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
    if (body.department !== undefined) data.department = body.department?.trim() || null;

    if (body.role) {
      if (!ALL_ROLES.includes(body.role as Role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      if (!canAssignRole(actorRole, body.role as Role)) {
        return NextResponse.json({ error: 'You cannot assign this role' }, { status: 403 });
      }
      data.role = body.role;
    }

    if (body.status) {
      if (!['active', 'inactive', 'suspended'].includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      data.status = body.status;
    }

    if (body.resetPassword) {
      const newPassword = body.password?.trim() || generateTempPassword();
      tempPassword = newPassword;
      data.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const user = await db.user.update({
      where: { id },
      data,
      select: {
        id: true, email: true, name: true, role: true, department: true, status: true, phone: true, employeeId: true, lastLoginAt: true,
      },
    });

    await logAudit({
      userId: session.user.id,
      action: body.resetPassword ? 'user.reset_password' : 'user.update',
      resource: `user:${id}`,
      details: {
        fields: Object.keys(data).filter((k) => k !== 'passwordHash'),
        targetEmail: target.email,
      },
      ipAddress: getClientIp(request),
    });

    if (body.resetPassword && tempPassword) {
      sendPasswordResetEmail(user.email, user.name, tempPassword).catch((err) =>
        console.warn('[email] reset failed:', err)
      );
    }

    return NextResponse.json({ user, tempPassword });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { error, session } = await requireUserManagement();
    if (error || !session) return error;

    const actorRole = session.user.role as Role;
    if (actorRole !== 'super_admin' && actorRole !== 'admin') {
      return NextResponse.json({ error: 'Only admins can deactivate accounts' }, { status: 403 });
    }

    const { id } = await context.params;
    if (id === session.user.id) {
      return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 });
    }

    const target = await db.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true },
    });
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (target.role === 'super_admin' && actorRole !== 'super_admin') {
      return NextResponse.json({ error: 'Cannot deactivate super admin' }, { status: 403 });
    }

    const user = await db.user.update({
      where: { id },
      data: { status: 'inactive' },
      select: { id: true, email: true, status: true },
    });

    await logAudit({
      userId: session.user.id,
      action: 'user.update',
      resource: `user:${id}`,
      details: { action: 'deactivate', targetEmail: target.email },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Failed to deactivate user' }, { status: 500 });
  }
}
