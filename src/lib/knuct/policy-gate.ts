import { NextResponse } from 'next/server';
import { getIdentityMode } from '@/lib/settings/identity-mode-server';
import {
  isKnuctUiEnabled,
  knuctPolicyBlockedMessage,
} from '@/lib/settings/identity-mode';

/** Returns a 403 response when campus identity mode is password_only. */
export async function rejectIfKnuctPolicyDisabled(): Promise<NextResponse | null> {
  const mode = await getIdentityMode();
  if (isKnuctUiEnabled(mode)) return null;
  return NextResponse.json({ error: knuctPolicyBlockedMessage() }, { status: 403 });
}

export async function isKnuctCampusPolicyEnabled(): Promise<boolean> {
  const mode = await getIdentityMode();
  return isKnuctUiEnabled(mode);
}
