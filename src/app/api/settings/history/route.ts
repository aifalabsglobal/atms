import { NextResponse } from 'next/server';
import { requireSection } from '@/lib/auth-helpers';
import { getSettingHistory } from '@/lib/settings';
import { ensureSettingsMigrated } from '@/lib/settings/migrate-from-legacy';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { error } = await requireSection('settings');
    if (error) return error;

    await ensureSettingsMigrated();
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    if (!key) return NextResponse.json({ error: 'key is required' }, { status: 400 });

    const take = Math.min(100, parseInt(searchParams.get('take') || '50', 10) || 50);
    const history = await getSettingHistory(key, take);
    return NextResponse.json({ key, history });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load history';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
