import { NextResponse } from 'next/server';
import { requireSection } from '@/lib/auth-helpers';
import { addFavorite, listFavorites, removeFavorite } from '@/lib/settings';
import { ensureSettingsMigrated } from '@/lib/settings/migrate-from-legacy';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { error, session } = await requireSection('settings');
    if (error || !session) return error;
    await ensureSettingsMigrated();
    const settings = await listFavorites(session.user.id);
    return NextResponse.json({ settings });
  } catch (err) {
    console.error('[settings] favorites GET:', err);
    return NextResponse.json({ error: 'Failed to load favorites' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { error, session } = await requireSection('settings');
    if (error || !session) return error;
    const body = await request.json().catch(() => ({}));
    const key = body.key as string | undefined;
    if (!key) return NextResponse.json({ error: 'key is required' }, { status: 400 });
    await addFavorite(session.user.id, key);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to add favorite';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { error, session } = await requireSection('settings');
    if (error || !session) return error;
    const body = await request.json().catch(() => ({}));
    const key = body.key as string | undefined;
    if (!key) return NextResponse.json({ error: 'key is required' }, { status: 400 });
    await removeFavorite(session.user.id, key);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to remove favorite' }, { status: 500 });
  }
}
