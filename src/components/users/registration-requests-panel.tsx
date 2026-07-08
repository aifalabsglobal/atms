'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Loader2, KeyRound } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Role } from '@/lib/store';
import { rolesForActor } from '@/lib/user-management';

type RegistrationRequest = {
  id: string;
  did: string;
  email: string;
  name: string;
  employeeId: string | null;
  phone: string | null;
  department: string | null;
  requestedRole: string;
  status: string;
  createdAt: string;
};

export function RegistrationRequestsPanel({ actorRole }: { actorRole: Role }) {
  const approveRoles = rolesForActor(actorRole);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [roleOverrides, setRoleOverrides] = useState<Record<string, Role>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['registration-requests'],
    queryFn: () =>
      fetch('/api/register/requests?status=pending')
        .then((r) => {
          if (!r.ok) throw new Error('Failed to load requests');
          return r.json() as Promise<{ requests: RegistrationRequest[]; total: number }>;
        }),
    refetchInterval: 15000,
  });

  const review = useMutation({
    mutationFn: async (payload: {
      id: string;
      action: 'approve' | 'reject';
      role?: Role;
    }) => {
      const res = await fetch('/api/register/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'Review failed');
      return body;
    },
    onSuccess: (_data, vars) => {
      toast({
        title: vars.action === 'approve' ? 'Registration approved' : 'Registration rejected',
        description:
          vars.action === 'approve'
            ? 'The user can now sign in with their Knuct private share.'
            : 'The applicant will receive an in-app notification after their account is created.',
      });
      queryClient.invalidateQueries({ queryKey: ['registration-requests'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Action failed', description: err.message, variant: 'destructive' });
    },
  });

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

  if (requests.length === 0) {
    return null;
  }

  return (
    <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/10">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-amber-700" />
          <CardTitle className="text-base">Knuct registration requests</CardTitle>
          <Badge variant="secondary">{requests.length} pending</Badge>
        </div>
        <CardDescription>
          Approve to create a campus account. For new-wallet registrations, the Knuct wallet is created on approval.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.map((req) => {
          const role = roleOverrides[req.id] ?? (req.requestedRole as Role);
          const busy = review.isPending && review.variables?.id === req.id;
          return (
            <div key={req.id} className="rounded-lg border bg-background p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{req.name}</p>
                  <p className="text-sm text-muted-foreground">{req.email}</p>
                  {req.employeeId && (
                    <p className="text-xs text-muted-foreground">ID: {req.employeeId}</p>
                  )}
                  {req.department && (
                    <p className="text-xs text-muted-foreground">{req.department}</p>
                  )}
                  <p className="text-[10px] font-mono text-muted-foreground mt-1 truncate max-w-md" title={req.did}>
                    DID: {req.did.slice(0, 28)}…
                  </p>
                </div>
                <Badge variant="outline">requested: {req.requestedRole}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={role}
                  onValueChange={(v) =>
                    setRoleOverrides((prev) => ({ ...prev, [req.id]: v as Role }))
                  }
                >
                  <SelectTrigger className="w-[160px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {approveRoles.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="gap-1 bg-green-700 hover:bg-green-800"
                  disabled={busy}
                  onClick={() =>
                    review.mutate({ id: req.id, action: 'approve', role })
                  }
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  disabled={busy}
                  onClick={() => review.mutate({ id: req.id, action: 'reject' })}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
