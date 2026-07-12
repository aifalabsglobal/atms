import { NextResponse } from 'next/server';
import { isGoogleSsoConfigured } from '@/lib/mfa';
import { getIdentityMode } from '@/lib/settings/identity-mode-server';
import { isKnuctLoginVisible, preferKnuctLogin } from '@/lib/settings/identity-mode';

export const dynamic = 'force-dynamic';

/** Public auth capability flags for the login page (no secrets). */
export async function GET() {
  const identityMode = await getIdentityMode();
  const knuctDid = isKnuctLoginVisible(identityMode);
  return NextResponse.json({
    google: isGoogleSsoConfigured(),
    mfa: true,
    knuctDid,
    password: true,
    identityMode,
    preferKnuctLogin: preferKnuctLogin(identityMode),
  });
}
