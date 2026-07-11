'use client';

import { useQuery } from '@tanstack/react-query';
import { DEFAULT_GENERAL_SETTINGS, type GeneralSettings } from '@/lib/settings/general-defaults';
import { DEFAULT_ORG_SETTINGS, type OrgSettings } from '@/lib/settings/org-defaults';
import type { ActiveAcademicYearSummary } from '@/lib/settings/academic-year-range';

export type PlatformSettingsPayload = {
  general: GeneralSettings;
  organization: OrgSettings;
  activeAcademicYear: ActiveAcademicYearSummary | null;
};

async function fetchPlatformSettings(): Promise<PlatformSettingsPayload> {
  const res = await fetch('/api/settings/platform');
  if (!res.ok) throw new Error('Failed to load platform settings');
  const data = (await res.json()) as {
    general?: GeneralSettings;
    organization?: OrgSettings;
    activeAcademicYear?: ActiveAcademicYearSummary | null;
  };
  return {
    general: data.general ?? DEFAULT_GENERAL_SETTINGS,
    organization: data.organization ?? DEFAULT_ORG_SETTINGS,
    activeAcademicYear: data.activeAcademicYear ?? null,
  };
}

const PLACEHOLDER: PlatformSettingsPayload = {
  general: DEFAULT_GENERAL_SETTINGS,
  organization: DEFAULT_ORG_SETTINGS,
  activeAcademicYear: null,
};

export function usePlatformSettings(enabled = true) {
  return useQuery({
    queryKey: ['platform-settings'],
    queryFn: fetchPlatformSettings,
    enabled,
    staleTime: 60_000,
    placeholderData: PLACEHOLDER,
    select: (data) => data.general,
  });
}

export function useOrgSettings(enabled = true) {
  return useQuery({
    queryKey: ['platform-settings'],
    queryFn: fetchPlatformSettings,
    enabled,
    staleTime: 60_000,
    placeholderData: PLACEHOLDER,
    select: (data) => data.organization,
  });
}

export function useActiveAcademicYear(enabled = true) {
  return useQuery({
    queryKey: ['platform-settings'],
    queryFn: fetchPlatformSettings,
    enabled,
    staleTime: 60_000,
    placeholderData: PLACEHOLDER,
    select: (data) => data.activeAcademicYear,
  });
}
