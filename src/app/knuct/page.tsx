'use client';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, LogOut, RefreshCw, ShieldCheck, Wallet, XCircle, Users, Timer,
} from 'lucide-react';
import { MyKnuctWalletPanel } from '@/components/knuct/my-knuct-wallet-panel';
import { KnuctCredentialsPanel } from '@/components/knuct/knuct-credentials-panel';
import { RegistrationRequestsPanel } from '@/components/users/registration-requests-panel';
import { WalletProvisionRequestsPanel } from '@/components/users/wallet-provision-requests-panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import type { Role } from '@/lib/store';

type KnuctStats = {
  wallets: { active: number; failed: number; pending: number };
  anchors: { today: number };
  didCoveragePct: number;
  recentActivity: { module: string; ref: string; hash?: string }[];
  adapterMode?: string;
  health?: string;
  circuitBreakerOpen?: boolean;
};

export default function KnuctConsolePage() {
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOps = session?.user?.knuctConsoleAccess === true;
  const actorRole = (session?.user?.role ?? 'visitor') as Role;

  const { data: statusData, isLoading } = useQuery({
    queryKey: ['knuct-status'],
    queryFn: async () => {
      const res = await fetch('/api/knuct');
      if (!res.ok) throw new Error('Failed to load Knuct status');
      return res.json() as Promise<{
        health?: { adapterMode?: string; health?: string; circuitBreakerOpen?: boolean };
        stats?: KnuctStats;
        config?: { enabled?: boolean };
        knuctConsoleAccess?: boolean;
      }>;
    },
    enabled: status === 'authenticated',
  });

  const { data: anchorsData, isLoading: anchorsLoading } = useQuery({
    queryKey: ['knuct-anchors'],
    queryFn: async () => {
      const res = await fetch('/api/knuct/anchors?limit=20');
      if (!res.ok) throw new Error('Failed to load anchors');
      return res.json() as Promise<{
        anchors: Array<{
          id: string;
          resourceType: string;
          resourceId: string;
          payloadHash: string;
          status: string;
          createdAt: string;
          knuctTxRef: string | null;
        }>;
      }>;
    },
    enabled: isOps,
  });

  const pilotMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/knuct/pilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sync: true, limit: 5 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? 'Pilot failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['knuct-status'] });
      const active = data.results?.filter((r: { status: string }) => r.status === 'active').length ?? 0;
      const failed = data.results?.filter((r: { status: string }) => r.status === 'failed').length ?? 0;
      toast({
        title: 'Pilot run complete',
        description: `${active} active, ${failed} failed`,
        variant: failed > 0 ? 'destructive' : 'default',
      });
    },
    onError: (err: Error) => {
      toast({ title: 'Pilot failed', description: err.message, variant: 'destructive' });
    },
  });

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const stats = statusData?.stats;
  const health = statusData?.health;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Knuct Operations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Signed in as {session?.user?.email}
            {isOps ? ' · operator' : ' · wallet user'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/knuct/verify">Public verify</Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void signOut({ callbackUrl: '/knuct/login' })}
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </Button>
        </div>
      </div>

      <MyKnuctWalletPanel />

      {isOps && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-brand" /> Ops center
                  </CardTitle>
                  <CardDescription>
                    Adapter {health?.adapterMode ?? '—'} · health {health?.health ?? 'unknown'}
                    {health?.circuitBreakerOpen ? ' · circuit open' : ''}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['knuct-status'] })}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    disabled={pilotMutation.isPending || !statusData?.config?.enabled}
                    onClick={() => pilotMutation.mutate()}
                  >
                    {pilotMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      'Run live pilot (5)'
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { label: 'Active wallets', value: stats?.wallets.active ?? '—', icon: Wallet },
                    { label: 'Anchors today', value: stats?.anchors.today ?? '—', icon: ShieldCheck },
                    { label: 'Failed', value: stats?.wallets.failed ?? '—', icon: XCircle },
                    { label: 'DID coverage', value: stats ? `${stats.didCoveragePct}%` : '—', icon: Users },
                    { label: 'Pending', value: stats?.wallets.pending ?? '—', icon: Timer },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border p-3 space-y-1">
                      <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-lg font-semibold">{item.value}</p>
                      <p className="text-[10px] text-muted-foreground">{item.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <RegistrationRequestsPanel actorRole={actorRole} opsMode />
          <WalletProvisionRequestsPanel canReview />

          <KnuctCredentialsPanel />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent blockchain anchors</CardTitle>
              <CardDescription>SHA-256 audit rows (server-side). Campus ATMS never shows this UI.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {anchorsLoading ? (
                <div className="p-4">
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Hash</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(anchorsData?.anchors ?? []).map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-xs">{a.resourceType}</TableCell>
                          <TableCell className="font-mono text-[10px]">
                            <Link
                              href={`/knuct/verify?hash=${a.payloadHash}`}
                              className="text-brand hover:underline"
                            >
                              {a.payloadHash.slice(0, 16)}…
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {a.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(a.createdAt).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(anchorsData?.anchors?.length ?? 0) === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                            No anchors yet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!isOps && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Wallet self-service only. Operator tools require <code className="font-mono">knuctConsoleAccess</code>.
        </p>
      )}
    </div>
  );
}
