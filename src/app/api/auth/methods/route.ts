import { NextResponse } from 'next/server';
import { isGoogleSsoConfigured } from '@/lib/mfa';

export const dynamic = 'force-dynamic';

/** Public auth capability flags for the login page (no secrets). */
export async function GET() {
  return NextResponse.json({
    google: isGoogleSsoConfigured(),
    mfa: true,
    knuctDid: true,
    password: true,
  });
}
