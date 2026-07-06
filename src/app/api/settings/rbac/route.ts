import { NextResponse } from 'next/server';
import { requireAuth, requireRoles } from '@/lib/auth-helpers';
import { logAudit, getClientIp } from '@/lib/audit';
import { enforceRateLimit } from '@/lib/rate-limit';
import type { Role, Section } from '@/lib/store';
import {
  getRbacMeta,
  saveRbacMatrix,
  resetRbacMatrix,
  validateRbacMatrix,
  resolveUserSections,
  listUserRbacOverrides,
} from '@/lib/rbac';
import { DEFAULT_ROLE_SECTIONS } from '@/lib/rbac-defaults';

export async function GET() {
  try {
    const { error, session } = await requireAuth();
    if (error || !session) return error;

    const role = session.user.role as Role;
    const userId = session.user.id;
    const meta = await getRbacMeta();
    const effectiveSections = await resolveUserSections(userId, role);

    if (role === 'super_admin' || role === 'admin') {
      const userOverrides = await listUserRbacOverrides();
      return NextResponse.json({
        matrix: meta.matrix,
        defaults: DEFAULT_ROLE_SECTIONS,
        updatedAt: meta.updatedAt,
        updatedBy: meta.updatedBy,
        userOverrides,
        effectiveSections,
      });
    }

    return NextResponse.json({
      myRole: role,
      sections: effectiveSections,
      effectiveSections,
    });
  } catch (err) {
    console.error('RBAC GET error:', err);
    return NextResponse.json({ error: 'Failed to load RBAC configuration' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const limited = await enforceRateLimit(`rbac-save:${getClientIp(request) ?? 'anon'}`, 10, 60_000);
    if (limited) return limited;

    const { error, session } = await requireRoles(['super_admin']);
    if (error || !session) return error;

    const body = await request.json();

    if (body.reset === true) {
      const matrix = await resetRbacMatrix(session.user.id);
      await logAudit({
        userId: session.user.id,
        action: 'rbac.reset',
        resource: 'rbac:default',
        details: { roles: Object.keys(matrix).length },
        ipAddress: getClientIp(request),
      });
      return NextResponse.json({ matrix, message: 'RBAC reset to defaults' });
    }

    const validated = validateRbacMatrix(body.matrix);
    if ('error' in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const matrix = await saveRbacMatrix(validated.matrix, session.user.id);
    await logAudit({
      userId: session.user.id,
      action: 'rbac.update',
      resource: 'rbac:default',
      details: { roles: Object.keys(matrix).length },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ matrix, message: 'RBAC configuration saved' });
  } catch (err) {
    console.error('RBAC PUT error:', err);
    return NextResponse.json({ error: 'Failed to save RBAC configuration' }, { status: 500 });
  }
}
