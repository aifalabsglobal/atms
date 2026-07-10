import { NextResponse } from 'next/server';
import { requireSection } from '@/lib/auth-helpers';
import { listRecent } from '@/lib/settings';
import { ensureSettingsMigrated } from '@/lib/settings/migrate-from-legacy';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { error, session } = await requireSection('settings');
    if (error || !session) return error;
    await ensureSettingsMigrated();
    const take = Math.min(50, parseInt(new URL(request.url).searchParams.get('take') || '20', 10) || 20);
    const settings = await listRecent(session.user.id, take);
    return NextResponse.json({ settings });
  } catch (err) {
    console.error('[settings] recent GET:', err);
    return NextResponse.json({ error: 'Failed to load recent settings' }, { status: 500 });
  }
}
