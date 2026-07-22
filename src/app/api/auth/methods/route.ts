import { NextResponse } from 'next/server';
import { isGoogleSsoConfigured } from '@/lib/mfa';

export const dynamic = 'force-dynamic';

/** Public auth capability flags for the campus login page (no secrets). Knuct DID is console-only. */
export async function GET() {
  return NextResponse.json({
    google: isGoogleSsoConfigured(),
    mfa: true,
    knuctDid: false,
    password: true,
    identityMode: 'password_only',
    preferKnuctLogin: false,
  });
}
