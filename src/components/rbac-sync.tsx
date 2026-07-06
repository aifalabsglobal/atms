'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore, resolveRoleSections } from '@/lib/store';
import type { Role, Section } from '@/lib/store';

export function RbacSync() {
  const { status } = useSession();
  const setRoleSections = useAppStore((s) => s.setRoleSections);
  const setUserEffectiveSections = useAppStore((s) => s.setUserEffectiveSections);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (status !== 'authenticated') {
      setRoleSections(null);
      setUserEffectiveSections(null);
      return;
    }

    let cancelled = false;

    async function loadRbac() {
      try {
        const res = await fetch('/api/settings/rbac');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        if (data.matrix) {
          setRoleSections(data.matrix as Record<Role, Section[]>);
        } else if (data.myRole && Array.isArray(data.sections)) {
          const base = resolveRoleSections(useAppStore.getState().roleSections);
          setRoleSections({ ...base, [data.myRole as Role]: data.sections as Section[] });
        }

        const effective = (data.effectiveSections ?? data.sections) as Section[] | undefined;
        if (Array.isArray(effective)) {
          setUserEffectiveSections(effective);
        }
      } catch {
        /* keep defaults in store */
      }
    }

    loadRbac();

    const onUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ['rbac-config'] });
      loadRbac();
    };
    window.addEventListener('rbac-updated', onUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener('rbac-updated', onUpdated);
    };
  }, [status, setRoleSections, setUserEffectiveSections, queryClient]);

  return null;
}

export function notifyRbacUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('rbac-updated'));
  }
}
