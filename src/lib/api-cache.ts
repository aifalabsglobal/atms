/** Short-lived in-memory response cache for expensive GET handlers (dev + single-instance). */
type Entry<T> = { expires: number; value: T };

const store = new Map<string, Entry<unknown>>();

export function getCachedJson<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    store.delete(key);
    return null;
  }
  return hit.value as T;
}

export function setCachedJson<T>(key: string, value: T, ttlMs = 45_000): T {
  store.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

export function invalidateCachePrefix(prefix: string) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
