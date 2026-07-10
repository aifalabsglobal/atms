import { NextResponse } from 'next/server';
import { requireRoles } from '@/lib/auth-helpers';
import { setSetting, type EffectiveSetting } from '@/lib/settings';
import { ensureSettingsMigrated } from '@/lib/settings/migrate-from-legacy';
import { invalidateSystemConfigCache } from '@/lib/system-config';
import { invalidateRbacCache } from '@/lib/rbac';
import { logAudit, getClientIp } from '@/lib/audit';
import { enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit(`settings-bulk:${getClientIp(request) ?? 'anon'}`, 10, 60_000);
    if (limited) return limited;

    const { error, session } = await requireRoles(['super_admin']);
    if (error || !session) return error;

    await ensureSettingsMigrated();
    const body = await request.json().catch(() => ({}));
    const entries = body.settings as Record<string, unknown> | undefined;
    if (!entries || typeof entries !== 'object') {
      return NextResponse.json({ error: 'settings object is required' }, { status: 400 });
    }

    const results: EffectiveSetting[] = [];
    for (const [key, value] of Object.entries(entries)) {
      results.push(
        await setSetting(key, value, {
          updatedBy: session.user.id,
          reason: 'bulk',
        }),
      );
    }

    invalidateSystemConfigCache();
    invalidateRbacCache();

    await logAudit({
      userId: session.user.id,
      action: 'settings.bulk',
      resource: 'settings',
      details: { count: results.length },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ settings: results, total: results.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bulk update failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
