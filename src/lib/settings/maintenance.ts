import { NextResponse } from 'next/server';
import { getGlobalBoolean } from './service';

const MAINTENANCE_BYPASS_ROLES = new Set(['super_admin', 'admin']);

/**
 * Block mutating API calls while campus maintenance mode is on,
 * unless the caller is admin / super_admin.
 */
export async function assertNotInMaintenance(role: string | undefined | null): Promise<NextResponse | null> {
  if (role && MAINTENANCE_BYPASS_ROLES.has(role)) return null;

  let enabled = false;
  try {
    enabled = await getGlobalBoolean('general.maintenance_mode', false);
  } catch {
    enabled = false;
  }

  if (!enabled) return null;

  return NextResponse.json(
    {
      error: 'Maintenance mode is enabled. Only administrators can make changes right now.',
      code: 'MAINTENANCE_MODE',
    },
    { status: 503 },
  );
}
