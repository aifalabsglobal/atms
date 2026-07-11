'use client';

import { usePlatformSettings } from '@/hooks/use-platform-settings';
import { DEFAULT_GENERAL_SETTINGS } from '@/lib/settings/general-defaults';

/** Campus default page size from General settings (rows per page). */
export function useListPageSize(fallback = DEFAULT_GENERAL_SETTINGS.paginationDefault) {
  const { data } = usePlatformSettings();
  const n = data?.paginationDefault ?? fallback;
  return Math.min(200, Math.max(5, Math.round(n) || fallback));
}
