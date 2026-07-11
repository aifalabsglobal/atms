'use client';

import { useQuery } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type RuntimeMeta = {
  runtime?: {
    knuct?: {
      liveEnabled?: boolean;
      anchorsEnabled?: boolean;
      chainPublish?: boolean;
    };
  };
};

/** Knuct campus status shown under General / Campus & experience settings. */
export function KnuctCampusDetailsCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['system-config-runtime', 'knuct-details'],
    queryFn: async () => {
      const res = await fetch('/api/settings/config');
      if (!res.ok) throw new Error('Failed to load Knuct status');
      return res.json() as Promise<RuntimeMeta>;
    },
    staleTime: 60_000,
  });

  const knuct = data?.runtime?.knuct;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Wallet className="h-4 w-4 text-brand" />
          Knuct details
        </CardTitle>
        <CardDescription className="text-xs">
          Campus wallet, DID login, credentials, and chain anchors. Tune flags under Integrations / Runtime.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading || !knuct ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <dl className="grid gap-2 sm:grid-cols-3 text-xs">
            <div className="rounded-md border px-3 py-2">
              <dt className="text-muted-foreground">Live Knuct</dt>
              <dd className="mt-1">
                <Badge variant={knuct.liveEnabled ? 'default' : 'outline'} className="text-[10px]">
                  {knuct.liveEnabled ? 'Enabled' : 'Mock / off'}
                </Badge>
              </dd>
            </div>
            <div className="rounded-md border px-3 py-2">
              <dt className="text-muted-foreground">Anchors</dt>
              <dd className="mt-1">
                <Badge variant={knuct.anchorsEnabled ? 'default' : 'outline'} className="text-[10px]">
                  {knuct.anchorsEnabled ? 'On' : 'Off'}
                </Badge>
              </dd>
            </div>
            <div className="rounded-md border px-3 py-2">
              <dt className="text-muted-foreground">Chain publish</dt>
              <dd className="mt-1">
                <Badge variant={knuct.chainPublish ? 'default' : 'outline'} className="text-[10px]">
                  {knuct.chainPublish ? 'On' : 'Off'}
                </Badge>
              </dd>
            </div>
          </dl>
        )}
        <p className="text-[10px] text-muted-foreground mt-3">
          Per-user DID, wallet status, and provision errors appear in Users → profile → Knuct details.
        </p>
      </CardContent>
    </Card>
  );
}
