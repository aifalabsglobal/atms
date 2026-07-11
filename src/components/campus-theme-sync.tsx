'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { usePlatformSettings } from '@/hooks/use-platform-settings';

/**
 * Applies campus "Default appearance" from platform settings.
 * Tracks the last applied campus value so placeholder → real data updates,
 * without resetting on every unrelated re-render.
 */
export function CampusThemeSync() {
  const { data } = usePlatformSettings(true);
  const { setTheme } = useTheme();
  const lastApplied = useRef<string | null>(null);

  useEffect(() => {
    const next = data?.theme;
    if (next !== 'light' && next !== 'dark' && next !== 'system') return;
    if (next === lastApplied.current) return;
    lastApplied.current = next;
    setTheme(next);
  }, [data?.theme, setTheme]);

  return null;
}
