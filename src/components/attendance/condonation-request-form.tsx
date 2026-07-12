'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, FileWarning, CheckCircle2, XCircle, Clock, ArrowRight, ShieldCheck, Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  attendanceRiskStatus,
  DEFAULT_ATTENDANCE_THRESHOLDS,
} from '@/lib/system-config-defaults';
import { condonationRoleCopy } from '@/lib/condonation-roles';
import { cn } from '@/lib/utils';
import type { Role } from '@/lib/roles';

type CondonationRow = {
  id: string;
  status: string;
  attendancePct: number;
  eligibilityPct: number;
  condonationPct: number;
  reason: string;
  supportingDocUrl: string | null;
  decisionNotes: string | null;
  createdAt: string;
  decidedAt: string | null;
  clearedForTerm?: boolean;
  clearedAt?: string | null;
};

type Clearance = {
  clearedForTerm: boolean;
  clearedAt: string | null;
  attendancePctSnapshot: number | null;
};

type Props = {
  attendancePct: number;
  totalSessions: number;
  eligibilityPct?: number;
  condonationPct?: number;
  canSubmit?: boolean;
  role: Role;
  clearance?: Clearance | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending review',
  approved: 'Approved — Cleared',
  rejected: 'Not approved',
  withdrawn: 'Withdrawn',
};

function statusBadgeClass(status: string) {
  if (status === 'pending') return 'bg-amber-100 text-amber-800 border-0';
  if (status === 'approved') return 'bg-emerald-100 text-emerald-800 border-0';
  if (status === 'rejected') return 'bg-rose-100 text-rose-800 border-0';
  return 'bg-muted text-muted-foreground border-0';
}

function FlowSteps({ active }: { active: 1 | 2 | 3 | 4 }) {
  const steps = [
    { n: 1 as const, label: 'Check %' },
    { n: 2 as const, label: 'Request' },
    { n: 3 as const, label: 'HOD reviews' },
    { n: 4 as const, label: 'Cleared / result' },
  ];
  return (
    <ol className="flex flex-wrap items-center gap-1.5 text-[11px] sm:text-xs">
      {steps.map((s, i) => (
        <li key={s.n} className="flex items-center gap-1.5">
          <span
            className={cn(
              'inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold',
              active >= s.n ? 'bg-brand text-white' : 'bg-muted text-muted-foreground',
            )}
          >
            {s.n}
          </span>
          <span className={cn(active >= s.n ? 'text-foreground font-medium' : 'text-muted-foreground')}>
            {s.label}
          </span>
          {i < steps.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground/60 mx-0.5" />}
        </li>
      ))}
    </ol>
  );
}

export function CondonationRequestForm({
  attendancePct,
  totalSessions,
  eligibilityPct = DEFAULT_ATTENDANCE_THRESHOLDS.eligibilityPct,
  condonationPct = DEFAULT_ATTENDANCE_THRESHOLDS.condonationPct,
  canSubmit = true,
  role,
  clearance,
}: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [supportingDocUrl, setSupportingDocUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const copy = condonationRoleCopy(role);

  const risk = attendanceRiskStatus(
    attendancePct,
    totalSessions,
    { eligibilityPct, condonationPct, requireHodForCondonation: true },
  );

  const { data, isLoading } = useQuery({
    queryKey: ['condonation-requests', 'mine'],
    queryFn: async () => {
      const res = await fetch('/api/attendance/condonation?status=all&limit=20');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load requests');
      return json as { requests: CondonationRow[] };
    },
  });

  const pending = data?.requests.find((r) => r.status === 'pending');
  const history = data?.requests ?? [];
  const cleared =
    clearance?.clearedForTerm ||
    history.some((r) => r.status === 'approved' && r.clearedForTerm);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/attendance/condonation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          supportingDocUrl: supportingDocUrl.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to submit');
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['condonation-requests'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-my-records'] });
      setReason('');
      setSupportingDocUrl('');
      toast({
        title: 'Request submitted',
        description: 'Next: HOD or Admin reviews. Approved = Cleared for term.',
      });
    },
    onError: (err: Error) => {
      toast({ title: 'Could not submit', description: err.message, variant: 'destructive' });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/attendance/condonation/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to withdraw');
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['condonation-requests'] });
      toast({ title: 'Request withdrawn' });
    },
    onError: (err: Error) => {
      toast({ title: 'Could not withdraw', description: err.message, variant: 'destructive' });
    },
  });

  const flowStep: 1 | 2 | 3 | 4 = cleared
    ? 4
    : pending
      ? 3
      : risk === 'watch' && canSubmit
        ? 2
        : 1;

  const eligibilityCopy =
    risk === 'no_data'
      ? 'No sessions recorded yet. Condonation becomes available once you have attendance history.'
      : risk === 'on_track'
        ? `Attendance (${attendancePct}%) is at or above ${eligibilityPct}% — no condonation needed.`
        : risk === 'at_risk'
          ? `Attendance (${attendancePct}%) is below ${condonationPct}%. Needs a direct HOD exception, not this form.`
          : `Attendance (${attendancePct}%) is in the watch band (${condonationPct}%–${eligibilityPct}%). You can request review.`;

  return (
    <div className="space-y-4">
      <Card className="rounded-xl shadow-sm">
        <CardHeader className="pb-3 space-y-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileWarning className="h-4 w-4 text-amber-600" />
              {copy.title}
            </CardTitle>
            <CardDescription className="mt-1 space-y-1">
              <span className="block">{copy.job}</span>
              <span className="block text-foreground/80">{copy.next}</span>
            </CardDescription>
          </div>
          <FlowSteps active={flowStep} />
        </CardHeader>
        <CardContent className="space-y-4">
          {cleared && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
              <ShieldCheck className="h-5 w-5 text-emerald-700 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-900">Condonation cleared for term</p>
                <p className="text-xs text-emerald-800/80">
                  Raw attendance stays {attendancePct}%. Campus accepted the shortfall
                  {clearance?.attendancePctSnapshot != null
                    ? ` (applied at ${clearance.attendancePctSnapshot}%)`
                    : ''}
                  .
                </p>
              </div>
            </div>
          )}

          <div className="rounded-lg border bg-muted/25 p-3 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">Attendance status</span>
              <Badge variant="outline" className="text-[10px]">
                {attendancePct}% · {totalSessions} sessions
              </Badge>
              <Badge
                className={cn(
                  'border-0 text-[10px]',
                  risk === 'watch' && 'bg-amber-100 text-amber-800',
                  risk === 'on_track' && 'bg-emerald-100 text-emerald-800',
                  risk === 'at_risk' && 'bg-rose-100 text-rose-800',
                  risk === 'no_data' && 'bg-muted text-muted-foreground',
                )}
              >
                {risk === 'watch' ? 'Watch band' : risk === 'on_track' ? 'Eligible' : risk === 'at_risk' ? 'Below band' : 'No data'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{eligibilityCopy}</p>
            <p className="text-xs text-foreground/80 flex items-start gap-1.5 pt-1">
              <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
              {pending
                ? 'What next: wait for HOD/Admin decision.'
                : risk === 'watch' && canSubmit
                  ? 'What next: submit a reason (≥20 characters).'
                  : copy.next}
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading requests…
            </div>
          ) : pending ? (
            <div className="space-y-3 rounded-lg border border-amber-200/70 bg-amber-50/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <Badge className={statusBadgeClass('pending')}>Pending review</Badge>
                <span className="text-[10px] text-muted-foreground">
                  Applied at {pending.attendancePct}%
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{pending.reason}</p>
              {canSubmit && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={withdrawMutation.isPending}
                  onClick={() => withdrawMutation.mutate(pending.id)}
                >
                  {withdrawMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  Withdraw request
                </Button>
              )}
            </div>
          ) : risk === 'watch' && canSubmit && !cleared ? (
            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-sm font-medium">Submit a request</p>
              <div className="grid gap-1.5">
                <Label className="text-xs">Reason *</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain circumstances (min 20 characters)…"
                  rows={4}
                  className="rounded-xl"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Supporting evidence (optional)</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*,application/pdf"
                    className="rounded-xl text-xs max-w-xs"
                    disabled={uploading || createMutation.isPending}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) {
                        toast({ title: 'File too large', description: 'Max 5 MB', variant: 'destructive' });
                        return;
                      }
                      setUploading(true);
                      try {
                        const reader = new FileReader();
                        const dataUrl = await new Promise<string>((resolve, reject) => {
                          reader.onload = () => resolve(String(reader.result));
                          reader.onerror = () => reject(new Error('Failed to read file'));
                          reader.readAsDataURL(file);
                        });
                        const res = await fetch('/api/attendance/condonation/upload', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ fileBase64: dataUrl }),
                        });
                        const json = await res.json();
                        if (!res.ok) throw new Error(json.error || 'Upload failed');
                        setSupportingDocUrl(json.url);
                        toast({ title: 'Evidence uploaded' });
                      } catch (err) {
                        toast({
                          title: 'Upload failed',
                          description: err instanceof Error ? err.message : 'Try again',
                          variant: 'destructive',
                        });
                      } finally {
                        setUploading(false);
                        e.target.value = '';
                      }
                    }}
                  />
                  {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {supportingDocUrl && !uploading && (
                    <a href={supportingDocUrl} target="_blank" rel="noreferrer" className="text-xs text-brand underline flex items-center gap-1">
                      <Upload className="h-3 w-3" /> View uploaded file
                    </a>
                  )}
                </div>
                <Input
                  type="url"
                  value={supportingDocUrl}
                  onChange={(e) => setSupportingDocUrl(e.target.value)}
                  placeholder="Or paste a document URL…"
                  className="rounded-xl"
                />
              </div>
              <Button
                className="bg-brand hover:bg-brand/90 text-white"
                disabled={createMutation.isPending || uploading || reason.trim().length < 20}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Submit to HOD/admin
              </Button>
            </div>
          ) : null}

          {history.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Request history</p>
              <ul className="space-y-2">
                {history.map((row) => (
                  <li key={row.id} className="rounded-lg border bg-background px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge className={statusBadgeClass(row.status)}>
                        {STATUS_LABEL[row.status] ?? row.status}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(row.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground line-clamp-2">{row.reason}</p>
                    {row.decisionNotes && (
                      <p className="mt-1 text-xs flex items-start gap-1">
                        {row.status === 'approved' ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5" />
                        ) : row.status === 'rejected' ? (
                          <XCircle className="h-3.5 w-3.5 text-rose-600 mt-0.5" />
                        ) : null}
                        {row.decisionNotes}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
