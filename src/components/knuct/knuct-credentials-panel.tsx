'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Award, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

type CredentialType = 'attendance_certificate' | 'grade_transcript' | 'compliance_report';

type CredentialRow = {
  id: string;
  type: string;
  resourceId: string | null;
  payloadHash: string;
  knuctAssetRef: string | null;
  verifyUrl: string | null;
  status: string;
  createdAt: string;
};

type CredentialsResponse = {
  enabled: boolean;
  credentials: CredentialRow[];
  stats: { today: number; week: number; failed: number; byType: Record<string, number> } | null;
};

type UserOption = { id: string; name: string; email: string; role: string };

const CREDENTIAL_TYPES: { value: CredentialType; label: string }[] = [
  { value: 'attendance_certificate', label: 'Attendance certificate' },
  { value: 'grade_transcript', label: 'Grade transcript' },
  { value: 'compliance_report', label: 'Compliance report' },
];

const statusStyle: Record<string, string> = {
  issued: 'bg-green-50 text-green-700 border-green-200',
  pending: 'bg-amber-50 text-amber-800 border-amber-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  unavailable: 'bg-gray-50 text-gray-600 border-gray-200',
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export function KnuctCredentialsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [credentialType, setCredentialType] = useState<CredentialType>('attendance_certificate');
  const [resourceId, setResourceId] = useState('');

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['credential-user-picker'],
    queryFn: () => fetchJson<{ users: UserOption[] }>('/api/knuct/users?category=campus&limit=100'),
  });

  const {
    data: credData,
    isLoading: credLoading,
    refetch: refetchCredentials,
    error: credError,
  } = useQuery({
    queryKey: ['knuct-credentials', selectedUserId],
    queryFn: () => fetchJson<CredentialsResponse>(`/api/knuct/credentials?userId=${selectedUserId}`),
    enabled: Boolean(selectedUserId),
  });

  const issueMutation = useMutation({
    mutationFn: () =>
      fetchJson<{ credential: { id: string; status: string; payloadHash: string } }>(
        '/api/knuct/credentials',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: selectedUserId,
            type: credentialType,
            resourceId: resourceId.trim() || undefined,
            payload: { issuedVia: 'knuct_console', at: new Date().toISOString() },
          }),
        },
      ),
    onSuccess: (data) => {
      toast({
        title: 'Credential queued',
        description: `Status: ${data.credential.status} · hash ${data.credential.payloadHash.slice(0, 12)}…`,
      });
      queryClient.invalidateQueries({ queryKey: ['knuct-credentials', selectedUserId] });
    },
    onError: (err: Error) => {
      toast({ title: 'Issue failed', description: err.message, variant: 'destructive' });
    },
  });

  const users = usersData?.users ?? [];
  const credentials = credData?.credentials ?? [];
  const stats = credData?.stats;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Award className="h-4 w-4 text-brand" /> Verifiable credentials
        </CardTitle>
        <CardDescription>
          Issue Knuct-backed credentials for students. Requires KNUCT_ENABLED and KNUCT_CREDENTIALS_ENABLED in .env;
          live mint needs KNUCT_CREDENTIAL_MINT_URL.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={credData?.enabled ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600'}
          >
            Credentials {credData?.enabled ? 'enabled' : 'disabled'}
          </Badge>
          {selectedUserId && credData && !credData.enabled && (
            <span className="text-xs text-amber-700">
              Records are hash-only until KNUCT_CREDENTIALS_ENABLED=true
            </span>
          )}
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 rounded-lg border p-3">
            {[
              { label: 'Issued today', value: stats.today },
              { label: 'Issued (7d)', value: stats.week },
              { label: 'Failed', value: stats.failed },
              { label: 'Types', value: Object.keys(stats.byType).length },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-lg font-bold">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs">Student</Label>
            {usersLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select student…" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} · {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Credential type</Label>
            <Select value={credentialType} onValueChange={(v) => setCredentialType(v as CredentialType)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CREDENTIAL_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Resource ID (optional)</Label>
          <Input
            className="h-9 font-mono text-xs"
            placeholder="e.g. session id or course id"
            value={resourceId}
            onChange={(e) => setResourceId(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="gap-2 bg-brand hover:bg-brand/90"
            disabled={!selectedUserId || issueMutation.isPending}
            onClick={() => issueMutation.mutate()}
          >
            {issueMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" />
            )}
            Issue credential
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            disabled={!selectedUserId}
            onClick={() => refetchCredentials()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh list
          </Button>
        </div>

        {!selectedUserId ? (
          <p className="text-xs text-muted-foreground">Select a student to view or issue credentials.</p>
        ) : credLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : credError ? (
          <p className="text-xs text-red-600">{(credError as Error).message}</p>
        ) : credentials.length === 0 ? (
          <p className="text-xs text-muted-foreground">No credentials for this user yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Hash</TableHead>
                  <TableHead>Verify</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {credentials.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs">{c.type.replace(/_/g, ' ')}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${statusStyle[c.status] ?? ''}`}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      <Link
                        href={`/knuct/verify?hash=${c.payloadHash}`}
                        target="_blank"
                        className="text-muted-foreground hover:text-brand hover:underline"
                      >
                        {c.payloadHash.slice(0, 10)}…
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.verifyUrl ? (
                        <a href={c.verifyUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                          Open
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(c.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
