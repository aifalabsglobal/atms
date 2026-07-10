'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, RefreshCw, Wallet, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type { Role } from '@/lib/store';

type WalletProvisionRequest = {
  id: string;
  requestType: string;
  status: string;
  userNote: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    department: string | null;
    knuctWallet: { status: string; did: string | null } | null;
  };
};

export function WalletProvisionRequestsPanel({ actorRole }: { actorRole: Role }) {
  const canReview = actorRole === 'super_admin' || actorRole === 'admin';
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['knuct-wallet-provision-requests'],
    queryFn: () =>
      fetch('/api/knuct/wallet-requests?status=pending').then((r) => {
        if (!r.ok) throw new Error('Failed to load wallet requests');
        return r.json() as Promise<{ requests: WalletProvisionRequest[]; total: number }>;
      }),
    enabled: canReview,
    refetchInterval: 60_000,
  });

  const review = useMutation({
    mutationFn: async (payload: { id: string; action: 'approve' | 'reject' }) => {
      const res = await fetch('/api/knuct/wallet-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? 'Review failed');
      return body;
    },
    onSuccess: (_data, vars) => {
      toast({
        title: vars.action === 'approve' ? 'Wallet request approved' : 'Wallet request rejected',
        description:
          vars.action === 'approve'
            ? 'Knuct wallet provisioning has started for this user.'
            : 'The user can submit a new request if needed.',
      });
      queryClient.invalidateQueries({ queryKey: ['knuct-wallet-provision-requests'] });
      queryClient.invalidateQueries({ queryKey: ['knuct-my-wallet'] });
      queryClient.invalidateQueries({ queryKey: ['knuct-status'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['settings-user-accounts'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Action failed', description: err.message, variant: 'destructive' });
    },
  });

  if (!canReview) return null;

  const requests = data?.requests ?? [];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (requests.length === 0) return null;

  return (
    <Card className="border-[#1A3C6E]/20 bg-[#1A3C6E]/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-[#1A3C6E]" />
          <CardTitle className="text-base">Knuct wallet provision requests</CardTitle>
          <Badge variant="secondary">{requests.length} pending</Badge>
        </div>
        <CardDescription>
          Approve to create or re-provision a user&apos;s Knuct wallet. Re-provisioning replaces their DID and private share.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.map((req) => {
          const busy = review.isPending && review.variables?.id === req.id;
          return (
            <div key={req.id} className="rounded-lg border bg-background p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{req.user.name}</p>
                  <p className="text-sm text-muted-foreground">{req.user.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {req.user.role.replace('_', ' ')}
                    {req.user.department ? ` · ${req.user.department}` : ''}
                  </p>
                  <Badge variant="outline" className="mt-2 text-[10px]">
                    {req.requestType === 'reprovision' ? 'Re-provision' : 'New wallet'}
                  </Badge>
                  {req.userNote && (
                    <p className="text-xs text-muted-foreground mt-2">{req.userNote}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-[#1A3C6E] hover:bg-[#1A3C6E]/90 gap-1"
                    disabled={busy}
                    onClick={() => review.mutate({ id: req.id, action: 'approve' })}
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => review.mutate({ id: req.id, action: 'reject' })}
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
