'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Loader2, FileWarning } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAppStore } from '@/lib/store';
import { condonationRoleCopy } from '@/lib/condonation-roles';
import type { Role } from '@/lib/roles';

type CondonationRequest = {
  id: string;
  attendancePct: number;
  eligibilityPct: number;
  condonationPct: number;
  reason: string;
  supportingDocUrl: string | null;
  status: string;
  createdAt: string;
  departmentId: string | null;
  clearedForTerm?: boolean;
  student: {
    id: string;
    name: string;
    email: string;
    department: string | null;
    employeeId: string | null;
  };
};

type Meta = {
  canDecide: boolean;
  requireHodForCondonation: boolean;
  roleCopy: { title: string; job: string; next: string };
};

export function CondonationRequestsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const role = useAppStore((s) => s.currentUser?.role) as Role | undefined;
  const fallbackCopy = condonationRoleCopy(role ?? 'faculty');
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['condonation-requests', 'pending'],
    queryFn: async () => {
      const res = await fetch('/api/attendance/condonation?status=pending&limit=50');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load requests');
      return json as { requests: CondonationRequest[]; total: number; meta?: Meta };
    },
    refetchInterval: 60_000,
  });

  const canDecide = data?.meta?.canDecide ?? false;
  const copy = data?.meta?.roleCopy ?? fallbackCopy;

  const review = useMutation({
    mutationFn: async (payload: { id: string; decision: 'approved' | 'rejected'; notes?: string }) => {
      const res = await fetch(`/api/attendance/condonation/${payload.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: payload.decision, notes: payload.notes }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'Review failed');
      return body;
    },
    onSuccess: (_data, vars) => {
      toast({
        title:
          vars.decision === 'approved'
            ? 'Approved — student Cleared for term'
            : 'Condonation rejected',
      });
      queryClient.invalidateQueries({ queryKey: ['condonation-requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Action failed', description: err.message, variant: 'destructive' });
    },
  });

  const requests = data?.requests ?? [];

  if (isLoading) {
    return (
      <Card className="rounded-xl shadow-sm">
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl shadow-sm border-amber-200 bg-amber-50/30 dark:bg-amber-950/10">
      <CardHeader className="pb-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <FileWarning className="h-5 w-5 text-amber-700" />
          <CardTitle className="text-base">{copy.title}</CardTitle>
          <Badge variant="secondary">{data?.total ?? requests.length} pending</Badge>
          {!canDecide && (
            <Badge variant="outline" className="text-[10px]">
              View only
            </Badge>
          )}
        </div>
        <CardDescription className="space-y-1">
          <span className="block">{copy.job}</span>
          <span className="block">{copy.next}</span>
          <span className="block text-foreground/70">
            Approve clears the student for the term (raw % unchanged). Snapshotted % is what they applied with.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No pending requests in your scope.
          </p>
        ) : (
          requests.map((req) => {
            const busy = review.isPending && review.variables?.id === req.id;
            const rejectNotes = notes[req.id] ?? '';
            return (
              <div key={req.id} className="rounded-xl border bg-background p-4 space-y-3 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{req.student.name}</p>
                    <p className="text-sm text-muted-foreground">{req.student.email}</p>
                    {req.student.employeeId && (
                      <p className="text-xs text-muted-foreground">ID: {req.student.employeeId}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {req.student.department || (req.departmentId ? 'Department assigned' : 'No department')}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <Badge className="bg-amber-100 text-amber-800 border-0">
                      {req.attendancePct}% (band {req.condonationPct}–{req.eligibilityPct})
                    </Badge>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(req.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap rounded-lg bg-muted/40 p-3">{req.reason}</p>
                {req.supportingDocUrl && (
                  <a
                    href={req.supportingDocUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-brand underline"
                  >
                    Supporting document
                  </a>
                )}
                {canDecide ? (
                  <>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Decision notes (required to reject)</Label>
                      <Textarea
                        value={rejectNotes}
                        onChange={(e) => setNotes((n) => ({ ...n, [req.id]: e.target.value }))}
                        rows={2}
                        className="rounded-xl"
                        placeholder="Optional on approve; required on reject"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        disabled={busy}
                        onClick={() =>
                          review.mutate({ id: req.id, decision: 'approved', notes: rejectNotes || undefined })
                        }
                      >
                        {busy && review.variables?.decision === 'approved' ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        )}
                        Approve & clear
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy || !rejectNotes.trim()}
                        onClick={() =>
                          review.mutate({ id: req.id, decision: 'rejected', notes: rejectNotes })
                        }
                      >
                        {busy && review.variables?.decision === 'rejected' ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                        )}
                        Reject
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground rounded-lg bg-muted/40 p-2">
                    View only — HOD or Admin decides when the HOD gate is on.
                  </p>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
