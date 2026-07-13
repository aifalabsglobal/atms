import { NextResponse } from 'next/server';
import { ensureSettingsMigrated } from '@/lib/settings/migrate-from-legacy';
import { getGeneralSettings } from '@/lib/settings/general-config';
import { getOrgSettings } from '@/lib/settings/org-config';
import { getActiveAcademicYear } from '@/lib/settings/active-academic-year';
import { getIdentityMode } from '@/lib/settings/identity-mode-server';

export const dynamic = 'force-dynamic';

/**
 * Platform branding / general + organization settings for the app shell.
 * Public read — no secrets; values are campus display configuration.
 */
export async function GET() {
  try {
    await ensureSettingsMigrated();
    const [general, organization, activeAcademicYear, identityMode] = await Promise.all([
      getGeneralSettings(),
      getOrgSettings(),
      getActiveAcademicYear(),
      getIdentityMode(),
    ]);
    return NextResponse.json({ general, organization, activeAcademicYear, identityMode });
  } catch (err) {
    console.error('Platform settings GET error:', err);
    return NextResponse.json({ error: 'Failed to load platform settings' }, { status: 500 });
  }
}
