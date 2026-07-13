'use client';

import { useQuery } from '@tanstack/react-query';
import {
  DEFAULT_IDENTITY_MODE,
  isKnuctUiEnabled,
  parseIdentityMode,
  type IdentityMode,
} from '@/lib/settings/identity-mode';

async function fetchIdentityMode(): Promise<IdentityMode> {
  const res = await fetch('/api/auth/methods');
  if (!res.ok) return DEFAULT_IDENTITY_MODE;
  const data = (await res.json()) as { identityMode?: string };
  return parseIdentityMode(data.identityMode);
}

export function useIdentityMode(enabled = true) {
  const query = useQuery({
    queryKey: ['auth-identity-mode'],
    queryFn: fetchIdentityMode,
    enabled,
    staleTime: 30_000,
  });
  const identityMode = query.data ?? DEFAULT_IDENTITY_MODE;
  return {
    ...query,
    identityMode,
    knuctUiEnabled: isKnuctUiEnabled(identityMode),
  };
}
