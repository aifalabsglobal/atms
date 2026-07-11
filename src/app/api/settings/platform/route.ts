import { NextResponse } from 'next/server';
import { ensureSettingsMigrated } from '@/lib/settings/migrate-from-legacy';
import { getGeneralSettings } from '@/lib/settings/general-config';

export const dynamic = 'force-dynamic';

/**
 * Platform branding / general settings for the app shell.
 * Public read — no secrets; values are campus display configuration.
 */
export async function GET() {
  try {
    await ensureSettingsMigrated();
    const general = await getGeneralSettings();
    return NextResponse.json({ general });
  } catch (err) {
    console.error('Platform settings GET error:', err);
    return NextResponse.json({ error: 'Failed to load platform settings' }, { status: 500 });
  }
}
