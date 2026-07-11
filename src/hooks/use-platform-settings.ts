'use client';

import { useQuery } from '@tanstack/react-query';
import { DEFAULT_GENERAL_SETTINGS, type GeneralSettings } from '@/lib/settings/general-defaults';

async function fetchPlatformSettings(): Promise<GeneralSettings> {
  const res = await fetch('/api/settings/platform');
  if (!res.ok) throw new Error('Failed to load platform settings');
  const data = (await res.json()) as { general?: GeneralSettings };
  return data.general ?? DEFAULT_GENERAL_SETTINGS;
}

export function usePlatformSettings(enabled = true) {
  return useQuery({
    queryKey: ['platform-settings'],
    queryFn: fetchPlatformSettings,
    enabled,
    staleTime: 60_000,
    placeholderData: DEFAULT_GENERAL_SETTINGS,
  });
}
