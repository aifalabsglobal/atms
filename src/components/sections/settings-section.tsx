'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Settings as SettingsIcon, Shield, Bell, Database, Server,
  ScanFace, MapPin, Clock, Lock, CheckCircle, X as XIcon, ScrollText,
  Link2, RefreshCw, Wallet,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore, ROLE_SECTIONS, ROLE_LABELS, type Role, type Section } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

const roles: Role[] = ['super_admin', 'admin', 'hod', 'faculty', 'lab_assistant', 'student', 'parent', 'visitor', 'security'];

const roleColors: Record<Role, string> = {
  super_admin: 'bg-red-100 text-red-800', admin: 'bg-orange-100 text-orange-800',
  hod: 'bg-purple-100 text-purple-800', faculty: 'bg-blue-100 text-blue-800',
  lab_assistant: 'bg-teal-100 text-teal-800', student: 'bg-green-100 text-green-800',
  parent: 'bg-amber-100 text-amber-800', visitor: 'bg-gray-100 text-gray-800',
  security: 'bg-rose-100 text-rose-800'
};

const navModules: { section: Section; name: string }[] = [
  { section: 'dashboard', name: 'Dashboard' },
  { section: 'masters', name: 'Masters' },
  { section: 'attendance', name: 'Attendance' },
  { section: 'lms', name: 'Learning Mgmt' },
  { section: 'users', name: 'Users & RBAC' },
  { section: 'violations', name: 'Violations' },
  { section: 'reports', name: 'Reports' },
  { section: 'geofences', name: 'Geofences' },
  { section: 'calendar', name: 'Calendar' },
  { section: 'settings', name: 'Settings' },
];

const systemConfig: {
  label: string;
  value: string;
  icon: React.ElementType;
  status: 'active' | 'demo' | 'planned';
}[] = [
  { label: 'Face Verification', value: 'Demo stub locally; set FACE_VERIFICATION_ENABLED + API URL for ArcFace', icon: ScanFace, status: 'demo' },
  { label: 'GPS Geofencing', value: 'Haversine (circle) + point-in-polygon', icon: MapPin, status: 'active' },
  { label: 'Min Attendance (Regulation)', value: '75% for eligibility', icon: Clock, status: 'active' },
  { label: 'Condonation Threshold', value: '65% with HOD approval', icon: Clock, status: 'active' },
  { label: 'Auth Method', value: 'next-auth JWT (credentials)', icon: Lock, status: 'active' },
  { label: 'Audit Logging', value: 'Login, user CRUD, violations, geofences, calendar publish', icon: ScrollText, status: 'active' },
  { label: 'Rate Limiting', value: 'Upstash Redis (prod) or in-memory (dev)', icon: Server, status: 'active' },
  { label: 'Email', value: 'Welcome/reset emails when SMTP or Resend env vars are set', icon: Bell, status: 'demo' },
  { label: 'Database', value: 'PostgreSQL (Neon) + Prisma migrations', icon: Database, status: 'active' },
  { label: 'Knuct Blockchain', value: 'Live pilot when KNUCT_ENABLED=true in .env', icon: Link2, status: 'demo' },
  { label: 'API', value: 'Next.js App Router (/api/*)', icon: Server, status: 'active' },
];

const statusBadge: Record<'active' | 'demo' | 'planned', { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-green-50 text-green-700 border-green-200' },
  demo: { label: 'Demo / partial', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  planned: { label: 'Planned', className: 'bg-gray-50 text-gray-600 border-gray-200' },
};

export default function SettingsSection() {
  const { currentUser } = useAppStore();
  const isAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'admin';
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [auditAnchorOnly, setAuditAnchorOnly] = useState(false);

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['audit-logs', auditAnchorOnly],
    queryFn: () => fetch(`/api/audit?limit=30${auditAnchorOnly ? '&anchorableOnly=true' : ''}`).then((r) => {
      if (!r.ok) throw new Error('Failed to load audit logs');
      return r.json();
    }),
    enabled: isAdmin,
  });

  const { data: knuctData, isLoading: knuctLoading, isError: knuctError, error: knuctQueryError, refetch: refetchKnuct } = useQuery({
    queryKey: ['knuct-status'],
    queryFn: () => fetch('/api/knuct').then((r) => {
      if (!r.ok) throw new Error('Failed to load Knuct status');
      return r.json();
    }),
    enabled: isAdmin,
  });

  const { data: anchorsData, isLoading: anchorsLoading } = useQuery({
    queryKey: ['knuct-anchors'],
    queryFn: () => fetch('/api/knuct/anchors?limit=20').then((r) => {
      if (!r.ok) throw new Error('Failed to load anchors');
      return r.json();
    }),
    enabled: isSuperAdmin,
  });

  const provisionMutation = useMutation({
    mutationFn: (userId?: string) =>
      fetch('/api/knuct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userId ? { userId } : {}),
      }).then((r) => {
        if (!r.ok) throw new Error('Provisioning failed');
        return r.json();
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['knuct-status'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      if (data.wallet?.status === 'active') {
        toast({ title: 'Wallet provisioned', description: `DID: ${data.wallet.did?.slice(0, 20)}…` });
      } else if (data.wallet?.status === 'failed') {
        toast({ title: 'Provisioning failed', description: data.wallet.lastError ?? 'Unknown error', variant: 'destructive' });
      }
    },
    onError: (err: Error) => {
      toast({ title: 'Provisioning failed', description: err.message, variant: 'destructive' });
    },
  });

  const pilotMutation = useMutation({
    mutationFn: () =>
      fetch('/api/knuct/pilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sync: true, limit: 5 }),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? 'Pilot failed');
        return data;
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['knuct-status'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      const active = data.results?.filter((r: { status: string }) => r.status === 'active').length ?? 0;
      toast({ title: 'Live pilot complete', description: `${active} wallets active` });
    },
    onError: (err: Error) => {
      toast({ title: 'Pilot failed', description: err.message, variant: 'destructive' });
    },
  });

  if (!currentUser) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1A3C6E]">System Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure system parameters, view RBAC matrix, and manage integrations</p>
      </div>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList className={isAdmin ? 'grid w-full max-w-3xl grid-cols-5' : 'grid w-full max-w-lg grid-cols-3'}>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="rbac">RBAC Matrix</TabsTrigger>
          {isAdmin && <TabsTrigger value="knuct">Knuct</TabsTrigger>}
          {isAdmin && <TabsTrigger value="audit">Audit Log</TabsTrigger>}
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        {/* System Configuration */}
        <TabsContent value="config" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {systemConfig.map(cfg => {
              const Icon = cfg.icon;
              return (
                <Card key={cfg.label}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-[#1A3C6E]/10 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-[#1A3C6E]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{cfg.label}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{cfg.value}</p>
                    </div>
                    <Badge variant="outline" className={`shrink-0 text-[10px] ${statusBadge[cfg.status].className}`}>
                      {cfg.status === 'active' ? <CheckCircle className="h-3 w-3 mr-1" /> : null}
                      {statusBadge[cfg.status].label}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* RBAC Permission Matrix */}
        <TabsContent value="rbac" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4 text-[#1A3C6E]" /> Role-Based Access Control Matrix</CardTitle>
              <CardDescription>Navigation access per role — synced with app shell (ROLE_SECTIONS)</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-card z-10 min-w-[160px]">Module</TableHead>
                      {roles.map(role => (
                        <TableHead key={role} className="text-center min-w-[80px]">
                          <Badge className={`${roleColors[role]} text-[10px] whitespace-nowrap`}>{ROLE_LABELS[role]}</Badge>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {navModules.map(mod => (
                      <TableRow key={mod.section}>
                        <TableCell className="sticky left-0 bg-card z-10 font-medium text-sm">{mod.name}</TableCell>
                        {roles.map(role => {
                          const hasAccess = ROLE_SECTIONS[role].includes(mod.section);
                          return (
                            <TableCell key={role} className="text-center">
                              {hasAccess ? (
                                <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                              ) : (
                                <XIcon className="h-4 w-4 text-gray-300 mx-auto" />
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Role Hierarchy */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Role Hierarchy</CardTitle>
              <CardDescription>Permission inheritance from highest to lowest</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 items-center">
                {roles.map((role, i) => (
                  <div key={role} className="flex items-center gap-2">
                    <Badge className={`${roleColors[role]} font-medium`}>{ROLE_LABELS[role]}</Badge>
                    {i < roles.length - 1 && <span className="text-muted-foreground text-sm">→</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="knuct" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-[#1A3C6E]" /> Knuct Wallet & DID
                </CardTitle>
                <CardDescription>
                  Live Knuct pilot — set KNUCT_ENABLED=true and optional KNUCT_API_KEY in .env
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {knuctLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-2/3" />
                  </div>
                ) : knuctError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    Failed to load Knuct status: {(knuctQueryError as Error)?.message ?? 'Unknown error'}.
                    {' '}Try <button type="button" className="underline font-medium" onClick={() => refetchKnuct()}>refresh</button>.
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg border p-4 space-y-2">
                        <p className="text-sm font-medium flex items-center gap-2"><Wallet className="h-4 w-4" /> Your wallet</p>
                        <p className="text-xs text-muted-foreground font-mono break-all">
                          DID: {knuctData?.wallet?.did ?? 'Not provisioned'}
                        </p>
                        <Badge variant="outline" className={
                          knuctData?.wallet?.status === 'active' ? 'bg-green-50 text-green-700' :
                          knuctData?.wallet?.status === 'failed' ? 'bg-red-50 text-red-700' :
                          'bg-amber-50 text-amber-700'
                        }>
                          {knuctData?.wallet?.status === 'active' ? 'active' :
                          knuctData?.wallet?.status === 'failed' ? 'failed' :
                          knuctData?.wallet?.status === 'pending' ? 'pending' :
                          'not provisioned'}
                        </Badge>
                        {knuctData?.wallet?.lastError && (
                          <p className="text-xs text-red-600">{knuctData.wallet.lastError}</p>
                        )}
                      </div>
                      <div className="rounded-lg border p-4 space-y-2">
                        <p className="text-sm font-medium">Adapter</p>
                        <p className="text-sm text-muted-foreground">
                          Mode: {knuctData?.health?.adapterMode ?? 'mock'} ·
                          Health: {knuctData?.health?.health ?? 'unknown'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          KNUCT_ENABLED: {knuctData?.config?.enabled ? 'true' : 'false'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Auto-provision on user create: {knuctData?.config?.walletOnUserCreate ? 'on' : 'off'}
                        </p>
                      </div>
                    </div>

                    {isSuperAdmin && knuctData?.stats && (
                      <div className="rounded-lg border p-4 space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            { label: 'Active wallets', value: knuctData.stats.wallets.active },
                            { label: 'Anchors today', value: knuctData.stats.anchors.today },
                            { label: 'Failed wallets', value: knuctData.stats.wallets.failed },
                            { label: 'DID coverage', value: `${knuctData.stats.didCoveragePct}%` },
                          ].map((s) => (
                            <div key={s.label}>
                              <p className="text-lg font-bold">{s.value}</p>
                              <p className="text-[10px] text-muted-foreground">{s.label}</p>
                            </div>
                          ))}
                        </div>
                        {knuctData.stats.recentActivity.length > 0 && (
                          <div className="space-y-1.5 pt-2 border-t">
                            <p className="text-xs font-medium">Recent hash anchors</p>
                            {knuctData.stats.recentActivity.slice(0, 5).map((a: { module: string; ref: string; hash?: string }, i: number) => (
                              <div key={i} className="text-[10px] font-mono text-muted-foreground flex items-center justify-between gap-2">
                                <span className="shrink-0">{a.module}</span>
                                {a.hash ? (
                                  <Link
                                    href={`/verify?hash=${a.hash}`}
                                    target="_blank"
                                    className="truncate hover:text-[#1A3C6E] hover:underline"
                                    title={a.hash}
                                  >
                                    {a.hash.slice(0, 16)}…
                                  </Link>
                                ) : (
                                  <span>{a.ref}…</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        disabled={provisionMutation.isPending}
                        onClick={() => provisionMutation.mutate(undefined)}
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${provisionMutation.isPending ? 'animate-spin' : ''}`} />
                        {knuctData?.wallet?.status === 'active' ? 'Re-provision wallet' : 'Provision my wallet'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => refetchKnuct()}>Refresh status</Button>
                      <Button size="sm" variant="ghost" asChild>
                        <Link href="/verify" target="_blank">Public verify page</Link>
                      </Button>
                      {isSuperAdmin && knuctData?.config?.enabled && (
                        <Button
                          size="sm"
                          disabled={pilotMutation.isPending}
                          onClick={() => pilotMutation.mutate()}
                        >
                          {pilotMutation.isPending ? 'Running pilot…' : 'Run live pilot (5)'}
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {isSuperAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ScrollText className="h-4 w-4 text-[#1A3C6E]" /> Blockchain Anchors
                  </CardTitle>
                  <CardDescription>Recent SHA-256 audit anchors stored in PostgreSQL (latest 20)</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {anchorsLoading ? (
                    <div className="p-4 space-y-2">
                      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Resource type</TableHead>
                            <TableHead>Resource ID</TableHead>
                            <TableHead>Hash</TableHead>
                            <TableHead>Created</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(anchorsData?.anchors ?? []).map((anchor: {
                            id: string;
                            resourceType: string;
                            resourceId: string;
                            payloadHash: string;
                            createdAt: string;
                          }) => (
                            <TableRow key={anchor.id}>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px] font-mono">{anchor.resourceType}</Badge>
                              </TableCell>
                              <TableCell className="text-xs font-mono text-muted-foreground" title={anchor.resourceId}>
                                {anchor.resourceId.length > 16 ? `${anchor.resourceId.slice(0, 16)}…` : anchor.resourceId}
                              </TableCell>
                              <TableCell className="text-xs font-mono">
                                <Link
                                  href={`/verify?hash=${anchor.payloadHash}`}
                                  target="_blank"
                                  className="text-muted-foreground hover:text-[#1A3C6E] hover:underline"
                                  title={anchor.payloadHash}
                                >
                                  {anchor.payloadHash.slice(0, 12)}…
                                </Link>
                              </TableCell>
                              <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                                {new Date(anchor.createdAt).toLocaleString('en-IN')}
                              </TableCell>
                            </TableRow>
                          ))}
                          {(anchorsData?.anchors ?? []).length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                                No anchors yet. Complete an attendance session or review a violation to create one.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ScrollText className="h-4 w-4 text-[#1A3C6E]" /> Enterprise Audit Trail
                </CardTitle>
                <CardDescription>
                  Immutable log of security-sensitive actions. The Anchor column shows a SHA-256 hash only for
                  session complete, violation review, geofence create, calendar publish, grade publish, and subject publish.
                  Logins and other actions show — until you perform one of those operations.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex flex-wrap gap-2 px-4 pb-3 border-b">
                  <Button
                    size="sm"
                    variant={auditAnchorOnly ? 'default' : 'outline'}
                    onClick={() => setAuditAnchorOnly(true)}
                  >
                    Anchor events only
                  </Button>
                  <Button
                    size="sm"
                    variant={!auditAnchorOnly ? 'default' : 'outline'}
                    onClick={() => setAuditAnchorOnly(false)}
                  >
                    All events
                  </Button>
                </div>
                {auditLoading ? (
                  <div className="p-4 space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Actor</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Resource</TableHead>
                          <TableHead>Anchor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(auditData?.logs ?? []).map((log: {
                          id: string; action: string; resource: string; createdAt: string;
                          anchorHash: string | null;
                          actor: { name: string; email: string } | null;
                        }) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-xs whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell className="text-xs">
                              {log.actor ? `${log.actor.name}` : 'System'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] font-mono">{log.action}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground font-mono">{log.resource}</TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground">
                              {log.anchorHash ? (
                                <Link
                                  href={`/verify?hash=${log.anchorHash}`}
                                  target="_blank"
                                  className="hover:text-[#1A3C6E] hover:underline"
                                  title={log.anchorHash}
                                >
                                  {log.anchorHash.slice(0, 12)}…
                                </Link>
                              ) : (
                                '—'
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        {(auditData?.logs ?? []).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                              {auditAnchorOnly
                                ? 'No anchor-linked events yet. Complete an attendance session (Attendance tab) or review a violation to create a hash.'
                                : 'No audit events yet. Actions will appear after logins and admin operations.'}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Notification Settings */}
        <TabsContent value="notifications" className="space-y-4">
          <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Only <strong>in-app notifications</strong> are fully wired today. SMS, push, and external email
              channels below are reference designs — not configurable in this demo build.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4 text-[#1A3C6E]" /> Notification Channels</CardTitle>
              <CardDescription>Planned multi-channel delivery (in-app is live)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { channel: 'In-App', status: 'active' as const, provider: 'Built-in (live)', events: 'All events — see bell icon in header' },
                  { channel: 'Email', status: 'demo' as const, provider: 'SMTP / Resend (env-dependent)', events: 'Welcome & password reset on user CRUD only' },
                  { channel: 'SMS', status: 'planned' as const, provider: 'Twilio (not integrated)', events: 'Critical alerts — planned' },
                  { channel: 'Push', status: 'planned' as const, provider: 'Firebase FCM (not integrated)', events: 'Attendance, deadlines — planned' },
                ].map(ch => (
                  <div key={ch.channel} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{ch.channel}</span>
                      <Badge variant="outline" className={`text-[10px] ${statusBadge[ch.status].className}`}>
                        {statusBadge[ch.status].label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Provider: {ch.provider}</p>
                    <p className="text-sm text-muted-foreground">Events: {ch.events}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notification Rules (reference)</CardTitle>
              <CardDescription>Target routing when external channels are enabled</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { rule: 'Low attendance warning (< 75%)', channels: 'In-App + Email + SMS', target: 'Student + Parent + HOD' },
                  { rule: 'Attendance marked successfully', channels: 'In-App', target: 'Student' },
                  { rule: 'Assignment due reminder (3 days)', channels: 'In-App + Push', target: 'Student' },
                  { rule: 'Grade published', channels: 'In-App + Email', target: 'Student' },
                  { rule: 'Violation detected', channels: 'In-App + Email + SMS', target: 'HOD + Admin + Security' },
                  { rule: 'New enrollment', channels: 'In-App + Email', target: 'Faculty' },
                ].map(r => (
                  <div key={r.rule} className="flex items-center justify-between border-b pb-3">
                    <div>
                      <p className="text-sm font-medium">{r.rule}</p>
                      <p className="text-xs text-muted-foreground">Channels: {r.channels}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{r.target}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
