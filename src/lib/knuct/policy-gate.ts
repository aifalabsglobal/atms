import { NextResponse } from 'next/server';
import { getAuthSession, requireKnuctConsoleSession, requireKnuctOpsAccess } from '@/lib/auth-helpers';

/**
 * Interactive Knuct APIs require a Knuct console session.
 * Silent backend anchors / wallet hooks are not gated here.
 */
export async function rejectUnlessKnuctConsoleSession(): Promise<NextResponse | null> {
  const { error } = await requireKnuctConsoleSession();
  return error;
}

/** Ops-only Knuct APIs (pilot, approve queues, credential mint). */
export async function rejectUnlessKnuctOpsAccess(): Promise<NextResponse | null> {
  const { error } = await requireKnuctOpsAccess();
  return error;
}

/** @deprecated Use rejectUnlessKnuctConsoleSession — identity_mode no longer gates Knuct APIs. */
export async function rejectIfKnuctPolicyDisabled(): Promise<NextResponse | null> {
  return rejectUnlessKnuctConsoleSession();
}

export async function isKnuctConsoleSession(): Promise<boolean> {
  const session = await getAuthSession();
  return session?.user?.authSurface === 'knuct' && !!session.user.id;
}

/** @deprecated Prefer isKnuctConsoleSession. */
export async function isKnuctCampusPolicyEnabled(): Promise<boolean> {
  return isKnuctConsoleSession();
}

export function knuctConsoleRequiredMessage(): string {
  return 'Knuct console session required. Sign in at /knuct/login.';
}
