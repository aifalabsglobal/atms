import { NextResponse } from 'next/server';
import { requireRoles, requireSection } from '@/lib/auth-helpers';
import { getEffectiveSetting, setSetting, touchRecent } from '@/lib/settings';
import { ensureSettingsMigrated } from '@/lib/settings/migrate-from-legacy';
import { invalidateSystemConfigCache } from '@/lib/system-config';
import { invalidateRbacCache } from '@/lib/rbac';
import { logAudit, getClientIp } from '@/lib/audit';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ key: string }> };

export async function GET(request: Request, ctx: Ctx) {
  try {
    const { error, session } = await requireSection('settings');
    if (error || !session) return error;

    await ensureSettingsMigrated();
    const { key: rawKey } = await ctx.params;
    const key = decodeURIComponent(rawKey);

    const setting = await getEffectiveSetting(key, { userId: session.user.id });
    void touchRecent(session.user.id, key).catch(() => undefined);
    return NextResponse.json({ setting });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load setting';
    const status = message.startsWith('Unknown setting') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: Request, ctx: Ctx) {
  try {
    const limited = await (await import('@/lib/rate-limit')).enforceRateLimit(
      `settings-set:${getClientIp(request) ?? 'anon'}`,
      30,
      60_000,
    );
    if (limited) return limited;

    const { error, session } = await requireRoles(['super_admin']);
    if (error || !session) return error;

    await ensureSettingsMigrated();
    const { key: rawKey } = await ctx.params;
    const key = decodeURIComponent(rawKey);
    const body = await request.json().catch(() => ({}));
    if (!('value' in body)) {
      return NextResponse.json({ error: 'value is required' }, { status: 400 });
    }

    const setting = await setSetting(key, body.value, {
      updatedBy: session.user.id,
      reason: typeof body.reason === 'string' ? body.reason : undefined,
    });

    if (key.startsWith('attendance.') || key.startsWith('policies.') || key.startsWith('geofence.') || key.startsWith('notifications.')) {
      invalidateSystemConfigCache();
    }
    if (key === 'rbac.matrix') invalidateRbacCache();

    await logAudit({
      userId: session.user.id,
      action: 'settings.set',
      resource: `setting:${key}`,
      details: { key, source: setting.source },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ setting });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save setting';
    const status = message.startsWith('Unknown setting') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
