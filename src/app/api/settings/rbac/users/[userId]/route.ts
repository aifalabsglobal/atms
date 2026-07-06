import { NextResponse } from 'next/server';
import { requireRoles } from '@/lib/auth-helpers';
import { logAudit, getClientIp } from '@/lib/audit';
import { enforceRateLimit } from '@/lib/rate-limit';
import { ALL_SECTIONS } from '@/lib/rbac-defaults';
import {
  deleteUserRbacOverride,
  getUserRbacDetail,
  saveUserEffectiveSections,
} from '@/lib/rbac';
import type { Role, Section } from '@/lib/store';

type RouteContext = { params: Promise<{ userId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { error, session } = await requireRoles(['super_admin', 'admin']);
    if (error || !session) return error;

    const { userId } = await context.params;
    const detail = await getUserRbacDetail(userId);
    if (!detail) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (err) {
    console.error('User RBAC GET error:', err);
    return NextResponse.json({ error: 'Failed to load user RBAC' }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const limited = await enforceRateLimit(`rbac-user-save:${getClientIp(request) ?? 'anon'}`, 20, 60_000);
    if (limited) return limited;

    const { error, session } = await requireRoles(['super_admin']);
    if (error || !session) return error;

    const { userId } = await context.params;
    const detail = await getUserRbacDetail(userId);
    if (!detail) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const effectiveSections = body.effectiveSections as Section[] | undefined;
    if (!Array.isArray(effectiveSections)) {
      return NextResponse.json({ error: 'effectiveSections array is required' }, { status: 400 });
    }

    for (const section of effectiveSections) {
      if (!ALL_SECTIONS.includes(section)) {
        return NextResponse.json({ error: `Invalid section: ${section}` }, { status: 400 });
      }
    }

    const result = await saveUserEffectiveSections(
      userId,
      detail.user.role as Role,
      effectiveSections,
      session.user.id,
    );

    await logAudit({
      userId: session.user.id,
      action: 'rbac.user.update',
      resource: `user-rbac:${userId}`,
      details: {
        targetEmail: detail.user.email,
        grant: result.override?.grant ?? [],
        revoke: result.override?.revoke ?? [],
      },
      ipAddress: getClientIp(request),
    });

    const refreshed = await getUserRbacDetail(userId);
    return NextResponse.json({
      ...refreshed,
      message: 'User permissions updated',
    });
  } catch (err) {
    console.error('User RBAC PUT error:', err);
    return NextResponse.json({ error: 'Failed to save user RBAC' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { error, session } = await requireRoles(['super_admin']);
    if (error || !session) return error;

    const { userId } = await context.params;
    const detail = await getUserRbacDetail(userId);
    if (!detail) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await deleteUserRbacOverride(userId);

    await logAudit({
      userId: session.user.id,
      action: 'rbac.user.clear',
      resource: `user-rbac:${userId}`,
      details: { targetEmail: detail.user.email },
      ipAddress: getClientIp(request),
    });

    const refreshed = await getUserRbacDetail(userId);
    return NextResponse.json({ ...refreshed, message: 'User override cleared — role defaults apply' });
  } catch (err) {
    console.error('User RBAC DELETE error:', err);
    return NextResponse.json({ error: 'Failed to clear user RBAC' }, { status: 500 });
  }
}
