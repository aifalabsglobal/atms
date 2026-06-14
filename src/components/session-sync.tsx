'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore, type CurrentUser } from '@/lib/store';

export function SessionSync() {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const clearUser = useAppStore((s) => s.clearUser);
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session?.user) {
      if (lastUserId.current !== null) {
        queryClient.clear();
      }
      lastUserId.current = null;
      clearUser();
      return;
    }

    const user: CurrentUser = {
      id: session.user.id,
      name: session.user.name ?? '',
      email: session.user.email ?? '',
      role: session.user.role,
      department: session.user.department,
      avatar: session.user.avatar,
      profileImageUrl: session.user.profileImageUrl,
      linkedStudentId: session.user.linkedStudentId,
    };

    if (lastUserId.current !== null && lastUserId.current !== user.id) {
      queryClient.clear();
    }
    lastUserId.current = user.id;
    setCurrentUser(user);
  }, [session, status, setCurrentUser, clearUser, queryClient]);

  return null;
}
