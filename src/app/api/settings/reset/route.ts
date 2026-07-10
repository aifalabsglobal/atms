import { NextResponse } from 'next/server';
import { requireRoles } from '@/lib/auth-helpers';
import { resetCategory, resetSetting } from '@/lib/settings';
import type { SettingCategory } from '@/lib/settings';
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
    const category = body.category as SettingCategory | undefined;

    if (key) {
      const setting = await resetSetting(key, { updatedBy: session.user.id });
      invalidateSystemConfigCache();
      if (key === 'rbac.matrix') invalidateRbacCache();
      await logAudit({
        userId: session.user.id,
        action: 'settings.reset',
        resource: `setting:${key}`,
        ipAddress: getClientIp(request),
      });
      return NextResponse.json({ setting });
    }

    if (category) {
      const settings = await resetCategory(category, { updatedBy: session.user.id });
      invalidateSystemConfigCache();
      invalidateRbacCache();
      await logAudit({
        userId: session.user.id,
        action: 'settings.reset_category',
        resource: `settings:${category}`,
        details: { count: settings.length },
        ipAddress: getClientIp(request),
      });
      return NextResponse.json({ settings });
    }

    return NextResponse.json({ error: 'key or category is required' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Reset failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
