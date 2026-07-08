/**
 * Server-side store for in-flight DID auth sessions.
 * Persists Knuct cookie jars in Redis (or memory fallback) so challenge → response
 * works across serverless instances.
 */
import { createKnuctHttpAdapter, type KnuctHttpAdapter } from './knuct-client';
import { knuctKvDel, knuctKvGet, knuctKvSet } from './redis-store';

const TTL_SEC = 10 * 60; // 10 minutes (Knuct sessions last ~15 min)
const KEY_PREFIX = 'knuct:did-auth:';

function sessionKey(id: string): string {
  return `${KEY_PREFIX}${id}`;
}

async function saveAdapter(id: string, adapter: KnuctHttpAdapter): Promise<void> {
  await knuctKvSet(sessionKey(id), JSON.stringify(adapter.exportCookies()), TTL_SEC);
}

async function loadAdapter(id: string): Promise<KnuctHttpAdapter | null> {
  const raw = await knuctKvGet(sessionKey(id));
  if (!raw) return null;
  try {
    const cookies = JSON.parse(raw) as Record<string, string>;
    const adapter = createKnuctHttpAdapter();
    adapter.loadCookies(cookies);
    return adapter;
  } catch {
    await knuctKvDel(sessionKey(id));
    return null;
  }
}

export async function createDIDAuthSession(sessionKey: string): Promise<KnuctHttpAdapter> {
  const adapter = createKnuctHttpAdapter();
  await saveAdapter(sessionKey, adapter);
  return adapter;
}

export async function getDIDAuthSession(sessionKey: string): Promise<KnuctHttpAdapter | null> {
  return loadAdapter(sessionKey);
}

export async function saveDIDAuthSession(sessionKey: string, adapter: KnuctHttpAdapter): Promise<void> {
  await saveAdapter(sessionKey, adapter);
}

export async function deleteDIDAuthSession(id: string): Promise<void> {
  await knuctKvDel(sessionKey(id));
}

/** Purge expired entries — no-op for Redis TTL; clears stale memory entries. */
export async function purgeDIDAuthSessions(): Promise<void> {
  /* Redis handles TTL; memory fallback purges on read in redis-store */
}
