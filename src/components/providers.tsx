'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';
import { SessionSync } from '@/components/session-sync';
import { RbacSync } from '@/components/rbac-sync';
import { Toaster } from '@/components/ui/toaster';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 3 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  }));

  return (
    <SessionProvider refetchInterval={5 * 60} refetchOnWindowFocus={false}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <SessionSync />
          <RbacSync />
          {children}
          <Toaster />
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}

export default Providers;
