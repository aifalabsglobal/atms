import { NextResponse } from 'next/server';
import { requireSection } from '@/lib/auth-helpers';
import { exportSettings } from '@/lib/settings';
import type { SettingCategory } from '@/lib/settings';
import { ensureSettingsMigrated } from '@/lib/settings/migrate-from-legacy';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { error } = await requireSection('settings');
    if (error) return error;

    await ensureSettingsMigrated();
    const category = new URL(request.url).searchParams.get('category') as SettingCategory | null;
    const payload = await exportSettings(category || undefined);
    return NextResponse.json(payload);
  } catch (err) {
    console.error('[settings] export error:', err);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
