import { NextResponse } from 'next/server';
import { requireRoles } from '@/lib/auth-helpers';
import { clearSettingOverride } from '@/lib/settings';
import type { SettingScope } from '@/lib/settings';
import { ensureSettingsMigrated } from '@/lib/settings/migrate-from-legacy';
import { invalidateSystemConfigCache } from '@/lib/system-config';
import { logAudit, getClientIp } from '@/lib/audit';
import { enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit(`settings-clear:${getClientIp(request) ?? 'anon'}`, 20, 60_000);
    if (limited) return limited;

    const { error, session } = await requireRoles(['super_admin']);
    if (error || !session) return error;

    await ensureSettingsMigrated();
    const body = await request.json().catch(() => ({}));
    const key = body.key as string | undefined;
    const scope = body.scope as SettingScope | undefined;
    const scopeId = body.scopeId as string | undefined;

    if (!key || !scope || !scopeId) {
      return NextResponse.json({ error: 'key, scope, and scopeId are required' }, { status: 400 });
    }
    if (scope === 'global') {
      return NextResponse.json({ error: 'Use reset for global values' }, { status: 400 });
    }

    const setting = await clearSettingOverride(key, {
      scope,
      scopeId,
      updatedBy: session.user.id,
      reason: typeof body.reason === 'string' ? body.reason : 'clear_override',
    });

    if (key.startsWith('attendance.') || key.startsWith('geofence.') || key.startsWith('notifications.')) {
      invalidateSystemConfigCache();
    }

    await logAudit({
      userId: session.user.id,
      action: 'settings.clear_override',
      resource: `setting:${key}`,
      details: { key, scope, scopeId },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ setting });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Clear override failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
