/**
 * Server-side in-memory store for in-flight DID auth adapter sessions.
 * Each user gets one KnuctHttpAdapter instance that persists across the
 * challenge → response → startnode → walletdata sequence so that
 * Knuct's session cookies are maintained.
 * Entries expire after 10 minutes (Knuct sessions last 15 min).
 */
import { KnuctHttpAdapter } from './knuct-client';

const TTL_MS = 10 * 60 * 1000;

interface Entry {
  adapter: KnuctHttpAdapter;
  expiresAt: number;
}

const store = new Map<string, Entry>();

export function createDIDAuthSession(userId: string): KnuctHttpAdapter {
  const adapter = new KnuctHttpAdapter();
  store.set(userId, { adapter, expiresAt: Date.now() + TTL_MS });
  return adapter;
}

export function getDIDAuthSession(userId: string): KnuctHttpAdapter | null {
  const entry = store.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(userId);
    return null;
  }
  return entry.adapter;
}

export function deleteDIDAuthSession(userId: string): void {
  store.delete(userId);
}

/** Purge expired entries (call occasionally to avoid memory leak) */
export function purgeDIDAuthSessions(): void {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.expiresAt) store.delete(key);
  }
}
