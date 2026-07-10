type Entry = { expires: number; value: unknown };

const store = new Map<string, Entry>();

export function settingsCacheGet<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    store.delete(key);
    return null;
  }
  return hit.value as T;
}

export function settingsCacheSet<T>(key: string, value: T, ttlMs = 60_000): T {
  store.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

export function settingsCacheInvalidate(prefix?: string) {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
