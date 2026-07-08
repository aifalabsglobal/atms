/**
 * Persist authenticated Knuct session cookies per user for CAPI calls
 * (getAccountInfo, getDashboard) after DID login completes.
 */
import { createKnuctHttpAdapter, type KnuctHttpAdapter } from './knuct-client';
import { knuctKvDel, knuctKvGet, knuctKvSet } from './redis-store';

const TTL_SEC = 14 * 60; // slightly under Knuct's 15 min session
const KEY_PREFIX = 'knuct:user-session:';

function userKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

export async function saveUserKnuctSession(
  userId: string,
  adapter: KnuctHttpAdapter
): Promise<void> {
  await knuctKvSet(userKey(userId), JSON.stringify(adapter.exportCookies()), TTL_SEC);
}

export async function loadUserKnuctSession(userId: string): Promise<KnuctHttpAdapter | null> {
  const raw = await knuctKvGet(userKey(userId));
  if (!raw) return null;
  try {
    const cookies = JSON.parse(raw) as Record<string, string>;
    const adapter = createKnuctHttpAdapter();
    adapter.loadCookies(cookies);
    return adapter;
  } catch {
    await knuctKvDel(userKey(userId));
    return null;
  }
}

export async function deleteUserKnuctSession(userId: string): Promise<void> {
  await knuctKvDel(userKey(userId));
}

/** End Knuct server session and remove persisted cookies (e.g. on app sign-out). */
export async function revokeUserKnuctSession(userId: string): Promise<void> {
  const adapter = await loadUserKnuctSession(userId);
  if (adapter) {
    await adapter.logout();
  }
  await deleteUserKnuctSession(userId);
}

export async function refreshUserKnuctSession(
  userId: string,
  adapter: KnuctHttpAdapter
): Promise<void> {
  await saveUserKnuctSession(userId, adapter);
}
