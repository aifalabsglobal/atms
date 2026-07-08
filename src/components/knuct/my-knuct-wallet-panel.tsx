'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown, ChevronUp, Coins, Download, KeyRound, Loader2, RefreshCw, Wallet,
} from 'lucide-react';
import { KnuctDIDAuthPanel } from '@/components/knuct/did-auth-panel';
import { parseKnuctAccountView } from '@/lib/knuct/account-view';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

type KnuctWalletStatus = {
  id: string;
  did: string | null;
  status: string;
  lastError: string | null;
  hasPrivShare?: boolean;
};

type KnuctStatusResponse = {
  config?: { enabled?: boolean };
  health?: { adapterMode?: string; health?: string };
  wallet?: KnuctWalletStatus | null;
};

type KnuctAccountResponse = {
  sessionActive: boolean;
  sessionStore?: string;
  accountInfo: unknown;
  dashboard: unknown;
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
};

export function MyKnuctWalletPanel({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(true);
  const [showAuth, setShowAuth] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery<KnuctStatusResponse>({
    queryKey: ['knuct-my-wallet'],
    queryFn: () =>
      fetch('/api/knuct').then((r) => {
        if (!r.ok) throw new Error('Failed to load wallet status');
        return r.json();
      }),
    refetchInterval: (query) =>
      query.state.data?.wallet?.status === 'pending' ? 3000 : false,
  });

  const wallet = data?.wallet;
  const walletActive = wallet?.status === 'active';

  const { data: capiData, refetch: refetchCapi } = useQuery<KnuctAccountResponse>({
    queryKey: ['knuct-capi-account'],
    queryFn: () =>
      fetch('/api/knuct/account').then((r) => {
        if (!r.ok) throw new Error('Failed to load Knuct account');
        return r.json();
      }),
    enabled: walletActive,
    retry: false,
  });

  const accountView = useMemo(
    () => parseKnuctAccountView(capiData?.accountInfo, capiData?.dashboard),
    [capiData?.accountInfo, capiData?.dashboard]
  );

  const provisionMutation = useMutation({
    mutationFn: () =>
      fetch('/api/knuct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }).then(async (r) => {
        const payload = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error((payload as { error?: string }).error ?? 'Provisioning failed');
        return payload;
      }),
    onSuccess: (payload) => {
      queryClient.invalidateQueries({ queryKey: ['knuct-my-wallet'] });
      queryClient.invalidateQueries({ queryKey: ['knuct-status'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      const status = (payload as { wallet?: KnuctWalletStatus }).wallet?.status;
      if (status === 'active') {
        toast({ title: 'Wallet ready', description: 'Your Knuct wallet is active. Download your private share and keep it safe.' });
      } else if (status === 'failed') {
        toast({
          title: 'Provisioning failed',
          description: (payload as { wallet?: KnuctWalletStatus }).wallet?.lastError ?? 'Unknown error',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Provisioning started',
          description: 'This can take 1–2 minutes on live Knuct. This panel will refresh automatically.',
        });
      }
    },
    onError: (err: Error) => {
      toast({ title: 'Provisioning failed', description: err.message, variant: 'destructive' });
    },
  });

  const statusLabel =
    wallet?.status === 'active'
      ? 'Active'
      : wallet?.status === 'pending'
        ? 'Provisioning…'
        : wallet?.status === 'failed'
          ? 'Failed'
          : 'Not provisioned';

  return (
    <Card className={cn('border-[#1A3C6E]/20', className)}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2 text-[#1A3C6E]">
                <Wallet className="h-4 w-4" />
                My Knuct Wallet
              </CardTitle>
              <CardDescription>
                Your campus blockchain identity — provision a wallet, download your private share, and view tokens after DID auth.
              </CardDescription>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-8 w-2/3" />
              </div>
            ) : isError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {(error as Error)?.message ?? 'Failed to load wallet'}
                {' '}
                <button type="button" className="underline font-medium" onClick={() => refetch()}>
                  Retry
                </button>
              </div>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">Wallet status</p>
                      <Badge variant="outline" className={STATUS_STYLES[wallet?.status ?? ''] ?? 'bg-muted text-muted-foreground'}>
                        {statusLabel}
                      </Badge>
                    </div>
                    <p className="text-xs font-mono break-all text-muted-foreground">
                      {wallet?.did ?? 'No DID yet'}
                    </p>
                    {wallet?.lastError && (
                      <p className="text-xs text-red-600">{wallet.lastError}</p>
                    )}
                    {!data?.config?.enabled && (
                      <p className="text-[11px] text-muted-foreground">
                        Live Knuct is off — wallets use mock mode until KNUCT_ENABLED=true.
                      </p>
                    )}
                  </div>

                  <div className="rounded-lg border p-3 space-y-2">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Coins className="h-4 w-4" />
                      Tokens & balance
                    </p>
                    {capiData?.sessionActive ? (
                      <>
                        {(accountView.balance || accountView.tokens.length > 0) ? (
                          <div className="space-y-2">
                            {accountView.balance && (
                              <p className="text-lg font-semibold">
                                {accountView.balance}
                                {accountView.currency ? ` ${accountView.currency}` : ''}
                              </p>
                            )}
                            {accountView.tokens.length > 0 && (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="h-8 text-xs">Token</TableHead>
                                    <TableHead className="h-8 text-xs text-right">Balance</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {accountView.tokens.map((token) => (
                                    <TableRow key={token.id}>
                                      <TableCell className="py-2 text-xs">
                                        <span className="font-medium">{token.name}</span>
                                        {token.symbol && (
                                          <span className="text-muted-foreground ml-1">({token.symbol})</span>
                                        )}
                                      </TableCell>
                                      <TableCell className="py-2 text-xs text-right font-mono">
                                        {token.balance ?? '—'}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Session active — waiting for token data from Knuct CAPI.
                          </p>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => refetchCapi()}>
                          Refresh tokens
                        </Button>
                      </>
                    ) : walletActive ? (
                      <p className="text-xs text-muted-foreground">
                        Authenticate with your private share below to unlock live token balances from Knuct.
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Provision your wallet first, then authenticate to view tokens.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    disabled={provisionMutation.isPending || wallet?.status === 'pending'}
                    onClick={() => provisionMutation.mutate()}
                  >
                    {provisionMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    {walletActive ? 'Re-provision wallet' : 'Provision my wallet'}
                  </Button>

                  {walletActive && wallet?.hasPrivShare !== false && (
                    <Button size="sm" variant="outline" className="gap-2" asChild>
                      <a href="/api/knuct/privshare" download>
                        <Download className="h-3.5 w-3.5" />
                        Download private share
                      </a>
                    </Button>
                  )}

                  {walletActive && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-2"
                      onClick={() => setShowAuth((v) => !v)}
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      {showAuth ? 'Hide DID auth' : capiData?.sessionActive ? 'Re-authenticate' : 'Unlock tokens (DID auth)'}
                    </Button>
                  )}

                  <Button size="sm" variant="ghost" onClick={() => { refetch(); refetchCapi(); }}>
                    Refresh
                  </Button>
                </div>

                {walletActive && showAuth && (
                  <KnuctDIDAuthPanel
                    compact
                    onSuccess={() => {
                      refetch();
                      queryClient.invalidateQueries({ queryKey: ['knuct-capi-account'] });
                      setShowAuth(false);
                      toast({ title: 'DID authenticated', description: 'Your Knuct session is active — token balances should appear above.' });
                    }}
                  />
                )}

                <p className="text-[11px] text-muted-foreground">
                  Keep your private share PNG safe — it is your Knuct login key. Never share it. Re-provisioning creates a new wallet and invalidates the old share.
                </p>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
