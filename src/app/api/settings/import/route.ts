import { NextResponse } from 'next/server';
import { requireRoles } from '@/lib/auth-helpers';
import { importSettings } from '@/lib/settings';
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
    const settings = (body.settings ?? body) as Record<string, unknown>;
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return NextResponse.json({ error: 'settings object is required' }, { status: 400 });
    }

    // Support export envelope { settings: { key: value } }
    const map =
      settings.settings && typeof settings.settings === 'object' && !Array.isArray(settings.settings)
        ? (settings.settings as Record<string, unknown>)
        : settings;

    const results = await importSettings(map, { updatedBy: session.user.id });
    invalidateSystemConfigCache();
    invalidateRbacCache();

    await logAudit({
      userId: session.user.id,
      action: 'settings.import',
      resource: 'settings',
      details: { count: results.length },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ settings: results, total: results.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
