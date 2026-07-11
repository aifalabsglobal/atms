import { NextResponse } from 'next/server';
import { requireSection } from '@/lib/auth-helpers';
import { listAllSettings } from '@/lib/settings';
import { ensureSettingsMigrated } from '@/lib/settings/migrate-from-legacy';
import type { SettingCategory } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { error, session } = await requireSection('settings');
    if (error || !session) return error;

    await ensureSettingsMigrated();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as SettingCategory | null;
    const search = searchParams.get('search') ?? undefined;

    const settings = await listAllSettings({
      category: category || undefined,
      search,
      userId: session.user.id,
      departmentId: searchParams.get('departmentId') ?? undefined,
    });

    return NextResponse.json({ settings, total: settings.length });
  } catch (err) {
    console.error('[settings] list error:', err);
    return NextResponse.json({ error: 'Failed to list settings' }, { status: 500 });
  }
}
