import { NextResponse } from 'next/server';
import { requireRoles } from '@/lib/auth-helpers';
import { rollbackSetting } from '@/lib/settings';
import { ensureSettingsMigrated } from '@/lib/settings/migrate-from-legacy';
import { invalidateSystemConfigCache } from '@/lib/system-config';
import { invalidateRbacCache } from '@/lib/rbac';
import { logAudit, getClientIp } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { error, session } = await requireRoles(['super_admin']);
    if (error || !session) return error;

    await ensureSettingsMigrated();
    const body = await request.json().catch(() => ({}));
    const key = body.key as string | undefined;
    const version = Number(body.version);
    if (!key || !Number.isFinite(version)) {
      return NextResponse.json({ error: 'key and version are required' }, { status: 400 });
    }

    const setting = await rollbackSetting(key, version, { updatedBy: session.user.id });
    invalidateSystemConfigCache();
    if (key === 'rbac.matrix') invalidateRbacCache();

    await logAudit({
      userId: session.user.id,
      action: 'settings.rollback',
      resource: `setting:${key}`,
      details: { version },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ setting });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Rollback failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
