'use client';

import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Settings as SettingsIcon, Shield, Bell, Database, Server,
  ScanFace, MapPin, Clock, Lock, CheckCircle, X as XIcon, ScrollText,
  Link2, RefreshCw, Wallet, Save, RotateCcw, UserCircle, Trash2, Download,
  Users, Building2, BookOpen, CalendarDays, MapPinned, BarChart3, Crown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { KnuctDIDAuthPanel } from '@/components/knuct/did-auth-panel';
import { UserAccountsPanel } from '@/components/users/user-accounts-panel';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore, ROLE_LABELS, useRoleSections, useSectionAccess, type Role, type Section, type SectionContext } from '@/lib/store';
import { ALL_ROLES, DEFAULT_ROLE_SECTIONS } from '@/lib/rbac-defaults';
import { notifyRbacUpdated } from '@/components/rbac-sync';
import { useToast } from '@/hooks/use-toast';
import type { SystemConfigSettings } from '@/lib/system-config-defaults';

type SystemConfigResponse = {
  settings: SystemConfigSettings;
  defaults: SystemConfigSettings;
  updatedAt: string | null;
  updatedBy: string | null;
  runtime: {
    faceVerification: { enabled: boolean; apiConfigured: boolean; mode: 'live' | 'demo' | 'disabled' };
    knuct: { liveEnabled: boolean; anchorsEnabled: boolean; chainPublish: boolean };
    email: { status: 'configured' | 'disabled'; provider: string | null };
    rateLimit: { backend: 'upstash' | 'memory' };
    database: { provider: string };
    auth: { method: string };
    geofencing: { algorithm: string };
  };
};

const roles: Role[] = ALL_ROLES;

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

const statusBadge: Record<'active' | 'demo' | 'planned' | 'disabled', { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-green-50 text-green-700 border-green-200' },
  demo: { label: 'Demo / partial', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  planned: { label: 'Planned', className: 'bg-gray-50 text-gray-600 border-gray-200' },
  disabled: { label: 'Disabled', className: 'bg-gray-50 text-gray-500 border-gray-200' },
};

type UserRbacDetail = {
  user: { id: string; name: string; email: string; role: Role; status: string };
  roleSections: Section[];
  effectiveSections: Section[];
  override: { grant: Section[]; revoke: Section[] };
};

function UserRbacOverridesPanel({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [draftEffective, setDraftEffective] = useState<Section[] | null>(null);
  const [userDirty, setUserDirty] = useState(false);

  const { data: usersData } = useQuery({
    queryKey: ['rbac-user-picker'],
    queryFn: () => fetch('/api/users?limit=200').then((r) => {
      if (!r.ok) throw new Error('Failed to load users');
      return r.json();
    }),
    enabled: isSuperAdmin,
  });

  const { data: userDetail, isLoading: detailLoading, refetch: refetchUserDetail } = useQuery<UserRbacDetail>({
    queryKey: ['rbac-user-detail', selectedUserId],
    queryFn: () => fetch(`/api/settings/rbac/users/${selectedUserId}`).then((r) => {
      if (!r.ok) throw new Error('Failed to load user permissions');
      return r.json();
    }),
    enabled: isSuperAdmin && !!selectedUserId,
  });

  useEffect(() => {
    if (userDetail?.effectiveSections) {
      setDraftEffective([...userDetail.effectiveSections]);
      setUserDirty(false);
    }
  }, [userDetail]);

  const saveUserMut = useMutation({
    mutationFn: async () => {
      if (!selectedUserId || !draftEffective) throw new Error('Select a user first');
      const res = await fetch(`/api/settings/rbac/users/${selectedUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ effectiveSections: draftEffective }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save user permissions');
      return json as UserRbacDetail;
    },
    onSuccess: () => {
      setUserDirty(false);
      notifyRbacUpdated();
      queryClient.invalidateQueries({ queryKey: ['rbac-config'] });
      queryClient.invalidateQueries({ queryKey: ['rbac-user-detail', selectedUserId] });
      toast({ title: 'User permissions saved', description: 'Effective access updated for this user.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    },
  });

  const clearUserMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/settings/rbac/users/${selectedUserId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to clear override');
      return json as UserRbacDetail;
    },
    onSuccess: (data) => {
      setDraftEffective([...data.effectiveSections]);
      setUserDirty(false);
      notifyRbacUpdated();
      queryClient.invalidateQueries({ queryKey: ['rbac-config'] });
      toast({ title: 'Override cleared', description: 'User now inherits role permissions only.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Clear failed', description: err.message, variant: 'destructive' });
    },
  });

  const roleSections = userDetail?.roleSections ?? [];
  const hasOverride = (userDetail?.override?.grant?.length ?? 0) > 0 || (userDetail?.override?.revoke?.length ?? 0) > 0;

  const sectionSource = (section: Section): 'role' | 'grant' | 'revoke' | 'none' => {
    if (!draftEffective) return 'none';
    const inRole = roleSections.includes(section);
    const inEff = draftEffective.includes(section);
    if (inEff && !inRole) return 'grant';
    if (!inEff && inRole) return 'revoke';
    if (inEff && inRole) return 'role';
    return 'none';
  };

  const toggleUserSection = (section: Section) => {
    if (!isSuperAdmin || !draftEffective || !userDetail) return;
    if (userDetail.user.role === 'super_admin' && (section === 'dashboard' || section === 'settings')) return;
    setDraftEffective((prev) => {
      const cur = prev ?? [];
      return cur.includes(section) ? cur.filter((s) => s !== section) : [...cur, section];
    });
    setUserDirty(true);
  };

  if (!isSuperAdmin) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <UserCircle className="h-4 w-4 text-[#1A3C6E]" /> User-Based Permissions
            </CardTitle>
            <CardDescription>
              Override role defaults for individual users — grants add modules, revokes remove them.
            </CardDescription>
          </div>
          {selectedUserId && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!userDirty || saveUserMut.isPending}
                onClick={() => userDetail && setDraftEffective([...userDetail.effectiveSections])}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Revert
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!hasOverride || clearUserMut.isPending}
                onClick={() => clearUserMut.mutate()}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear override
              </Button>
              <Button
                size="sm"
                className="bg-[#1A3C6E] hover:bg-[#1A3C6E]/90"
                disabled={!userDirty || saveUserMut.isPending || !draftEffective}
                onClick={() => saveUserMut.mutate()}
              >
                <Save className="h-3.5 w-3.5 mr-1" />
                {saveUserMut.isPending ? 'Saving…' : 'Save user'}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-md">
          <label className="text-sm font-medium mb-1.5 block">Select user</label>
          <Select value={selectedUserId || '__none__'} onValueChange={(v) => setSelectedUserId(v === '__none__' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="Choose a user to customize…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Choose a user…</SelectItem>
              {(usersData?.users ?? []).map((u: { id: string; name: string; email: string; role: string }) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name} · {ROLE_LABELS[u.role as Role] ?? u.role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!selectedUserId ? (
          <p className="text-sm text-muted-foreground">Pick a user to view and edit their effective module access.</p>
        ) : detailLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : userDetail && draftEffective ? (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">{userDetail.user.email}</Badge>
              <Badge className={roleColors[userDetail.user.role]}>{ROLE_LABELS[userDetail.user.role]}</Badge>
              {hasOverride && <Badge variant="secondary">Custom override active</Badge>}
            </div>
            <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" /> From role</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> Extra grant</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" /> Revoked from role</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {navModules.map((mod) => {
                const src = sectionSource(mod.section);
                const locked = userDetail.user.role === 'super_admin' && (mod.section === 'dashboard' || mod.section === 'settings');
                const checked = draftEffective.includes(mod.section);
                return (
                  <button
                    key={mod.section}
                    type="button"
                    disabled={locked || saveUserMut.isPending}
                    onClick={() => toggleUserSection(mod.section)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      checked ? 'border-green-200 bg-green-50/80' : 'border-gray-200 bg-muted/30'
                    } ${locked ? 'opacity-60 cursor-not-allowed' : 'hover:bg-muted/50 cursor-pointer'}`}
                  >
                    <span>{mod.name}</span>
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                      src === 'grant' ? 'bg-blue-500' : src === 'revoke' ? 'bg-red-400' : src === 'role' ? 'bg-green-500' : 'bg-gray-300'
                    }`} />
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Role baseline: {roleSections.length} modules · Effective: {draftEffective.length} modules
              {(userDetail.override.grant.length > 0 || userDetail.override.revoke.length > 0) && (
                <> · +{userDetail.override.grant.length} / −{userDetail.override.revoke.length}</>
              )}
            </p>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => refetchUserDetail()}>Retry load</Button>
        )}
      </CardContent>
    </Card>
  );
}

function ConfigurationPanel({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<SystemConfigSettings | null>(null);
  const [dirty, setDirty] = useState(false);

  const { data, isLoading, isError, error } = useQuery<SystemConfigResponse>({
    queryKey: ['system-config'],
    queryFn: () => fetch('/api/settings/config').then((r) => {
      if (!r.ok) throw new Error('Failed to load configuration');
      return r.json();
    }),
  });

  useEffect(() => {
    if (data?.settings && !dirty) {
      setDraft(JSON.parse(JSON.stringify(data.settings)) as SystemConfigSettings);
    }
  }, [data?.settings, dirty]);

  const saveMutation = useMutation({
    mutationFn: async (payload: { settings?: SystemConfigSettings; reset?: boolean }) => {
      const res = await fetch('/api/settings/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save configuration');
      return json as SystemConfigResponse & { message: string };
    },
    onSuccess: (result) => {
      setDraft(result.settings);
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ['system-config'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast({ title: 'Configuration saved', description: result.message });
    },
    onError: (err: Error) => {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    },
  });

  const settings = draft ?? data?.settings;
  const runtime = data?.runtime;
  const changed = dirty && draft && data?.settings
    ? JSON.stringify(draft) !== JSON.stringify(data.settings)
    : false;

  const patch = (updater: (prev: SystemConfigSettings) => SystemConfigSettings) => {
    if (!isSuperAdmin) return;
    setDraft((prev) => {
      const base = prev ?? data?.settings;
      if (!base) return prev;
      return updater(JSON.parse(JSON.stringify(base)) as SystemConfigSettings);
    });
    setDirty(true);
  };

  const runtimeCards = runtime ? [
    {
      label: 'Face Verification',
      value: runtime.faceVerification.mode === 'live'
        ? 'Live API configured'
        : runtime.faceVerification.mode === 'demo'
          ? 'Enabled — set FACE_VERIFICATION_API_URL for live matching'
          : 'Set FACE_VERIFICATION_ENABLED=true in .env',
      icon: ScanFace,
      status: runtime.faceVerification.mode === 'live' ? 'active' as const : runtime.faceVerification.enabled ? 'demo' as const : 'disabled' as const,
    },
    {
      label: 'GPS Geofencing',
      value: runtime.geofencing.algorithm,
      icon: MapPin,
      status: 'active' as const,
    },
    {
      label: 'Knuct Blockchain',
      value: runtime.knuct.liveEnabled
        ? `Live pilot · anchors ${runtime.knuct.anchorsEnabled ? 'on' : 'off'}${runtime.knuct.chainPublish ? ' · chain publish on' : ''}`
        : 'Hash anchors in DB · set KNUCT_ENABLED=true for live wallet',
      icon: Link2,
      status: runtime.knuct.liveEnabled ? 'active' as const : 'demo' as const,
    },
    {
      label: 'Email',
      value: runtime.email.status === 'configured'
        ? `Provider: ${runtime.email.provider ?? 'configured'}`
        : 'Configure RESEND_API_KEY or SMTP_* in .env',
      icon: Bell,
      status: runtime.email.status === 'configured' ? 'active' as const : 'demo' as const,
    },
    {
      label: 'Rate Limiting',
      value: runtime.rateLimit.backend === 'upstash' ? 'Upstash Redis' : 'In-memory (dev)',
      icon: Server,
      status: 'active' as const,
    },
    {
      label: 'Database',
      value: runtime.database.provider,
      icon: Database,
      status: 'active' as const,
    },
    {
      label: 'Auth Method',
      value: runtime.auth.method,
      icon: Lock,
      status: 'active' as const,
    },
    {
      label: 'API',
      value: 'Next.js App Router (/api/*)',
      icon: Server,
      status: 'active' as const,
    },
  ] : [];

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (isError || !settings) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Failed to load configuration: {(error as Error)?.message || 'Unknown error'}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {!isSuperAdmin && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="p-4 text-sm text-muted-foreground">
            Configuration is read-only for your role. Super Admin can edit attendance thresholds and policy toggles below.
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          {data?.updatedAt && (
            <p className="text-[10px] text-muted-foreground">
              Last saved: {new Date(data.updatedAt).toLocaleString('en-IN')}
              {data.updatedBy ? ` · by ${data.updatedBy}` : ''}
            </p>
          )}
        </div>
        {isSuperAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={saveMutation.isPending}
              onClick={() => {
                if (data?.settings) {
                  setDraft(JSON.parse(JSON.stringify(data.settings)) as SystemConfigSettings);
                  setDirty(false);
                }
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Discard
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate({ reset: true })}
            >
              Reset defaults
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-[#1A3C6E] hover:bg-[#1A3C6E]/90 text-white"
              disabled={!changed || saveMutation.isPending}
              onClick={() => draft && saveMutation.mutate({ settings: draft })}
            >
              <Save className="h-3.5 w-3.5" /> Save configuration
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#1A3C6E]" /> Attendance thresholds
            </CardTitle>
            <CardDescription>Used by dashboard, reports, and student risk badges</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="eligibilityPct">Eligibility minimum (%)</Label>
                <Input
                  id="eligibilityPct"
                  type="number"
                  min={50}
                  max={100}
                  disabled={!isSuperAdmin}
                  value={settings.attendance.eligibilityPct}
                  onChange={(e) => patch((s) => ({
                    ...s,
                    attendance: { ...s.attendance, eligibilityPct: Number(e.target.value) },
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="condonationPct">Condonation threshold (%)</Label>
                <Input
                  id="condonationPct"
                  type="number"
                  min={0}
                  max={100}
                  disabled={!isSuperAdmin}
                  value={settings.attendance.condonationPct}
                  onChange={(e) => patch((s) => ({
                    ...s,
                    attendance: { ...s.attendance, condonationPct: Number(e.target.value) },
                  }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Require HOD approval for condonation</p>
                <p className="text-xs text-muted-foreground">
                  Between {settings.attendance.condonationPct}% and {settings.attendance.eligibilityPct}%
                </p>
              </div>
              <Switch
                checked={settings.attendance.requireHodForCondonation}
                disabled={!isSuperAdmin}
                onCheckedChange={(v) => patch((s) => ({
                  ...s,
                  attendance: { ...s.attendance, requireHodForCondonation: v },
                }))}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#1A3C6E]" /> Attendance policies
            </CardTitle>
            <CardDescription>Runtime enforcement on self-mark and audit anchors</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                key: 'faceVerificationEnforced' as const,
                label: 'Enforce face verification',
                hint: 'Reject self-mark when selfie does not match profile photo',
              },
              {
                key: 'geofenceSelfMarkRequired' as const,
                label: 'Require geofence for self-mark',
                hint: 'When off, geofence checks are skipped even if session expects GPS',
              },
              {
                key: 'knuctAnchorsEnabled' as const,
                label: 'Record Knuct hash anchors',
                hint: 'Hash anchors on session complete, violations, calendar publish, etc.',
              },
              {
                key: 'auditLoggingEnabled' as const,
                label: 'Audit logging',
                hint: 'Reference flag — audit events continue when integrations are wired',
              },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between rounded-lg border p-3">
                <div className="pr-4">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.hint}</p>
                </div>
                <Switch
                  checked={settings.policies[item.key]}
                  disabled={!isSuperAdmin}
                  onCheckedChange={(v) => patch((s) => ({
                    ...s,
                    policies: { ...s.policies, [item.key]: v },
                  }))}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#1A3C6E]" /> Geofence defaults
            </CardTitle>
            <CardDescription>Default radius when creating circle geofences</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-w-xs">
              <Label htmlFor="defaultRadius">Default radius (meters)</Label>
              <Input
                id="defaultRadius"
                type="number"
                min={10}
                max={5000}
                disabled={!isSuperAdmin}
                value={settings.geofence.defaultRadiusMeters}
                onChange={(e) => patch((s) => ({
                  ...s,
                  geofence: { defaultRadiusMeters: Number(e.target.value) },
                }))}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4 text-[#1A3C6E]" /> Notification policies
            </CardTitle>
            <CardDescription>In-app rules; email requires env configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                key: 'lowAttendanceWarningEnabled' as const,
                label: `Low attendance warning (< ${settings.attendance.eligibilityPct}%)`,
                hint: 'In-app alert for students below eligibility',
              },
              {
                key: 'lowAttendanceEmailEnabled' as const,
                label: 'Email on low attendance',
                hint: 'Requires SMTP or Resend env vars',
              },
              {
                key: 'violationAlertEnabled' as const,
                label: 'Violation alerts',
                hint: 'Notify HOD/admin on confirmed violations',
              },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between rounded-lg border p-3">
                <div className="pr-4">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.hint}</p>
                </div>
                <Switch
                  checked={settings.notifications[item.key]}
                  disabled={!isSuperAdmin}
                  onCheckedChange={(v) => patch((s) => ({
                    ...s,
                    notifications: { ...s.notifications, [item.key]: v },
                  }))}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="h-4 w-4 text-[#1A3C6E]" /> Runtime integrations
          </CardTitle>
          <CardDescription>Read-only status from environment and live services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {runtimeCards.map((cfg) => {
              const Icon = cfg.icon;
              return (
                <div key={cfg.label} className="flex items-start gap-3 rounded-lg border p-4">
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
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SuperAdminControlCenter({ onNavigate }: { onNavigate: (section: Section, ctx?: SectionContext) => void }) {
  const modules: { section: Section; label: string; description: string; icon: typeof Shield }[] = [
    { section: 'masters', label: 'Masters', description: 'Departments, programs, subjects, academic years', icon: Building2 },
    { section: 'users', label: 'Users & RBAC', description: 'Directory, roles, wallets', icon: Users },
    { section: 'attendance', label: 'Attendance', description: 'Sessions, timetable, capture rules', icon: Clock },
    { section: 'lms', label: 'Learning', description: 'Courses, assignments, quizzes', icon: BookOpen },
    { section: 'geofences', label: 'Geofences', description: 'Campus zones and location rules', icon: MapPinned },
    { section: 'calendar', label: 'Calendar', description: 'Academic events and holidays', icon: CalendarDays },
    { section: 'violations', label: 'Violations', description: 'Policy breaches and actions', icon: Shield },
    { section: 'reports', label: 'Reports', description: 'Analytics and exports', icon: BarChart3 },
  ];

  const settingsShortcuts: { settingsTab: string; label: string; description: string; icon: typeof Shield }[] = [
    { settingsTab: 'users', label: 'User Accounts', description: 'Create teachers, students, all roles', icon: Users },
    { settingsTab: 'rbac', label: 'RBAC Matrix', description: 'Section access per role', icon: Shield },
    { settingsTab: 'config', label: 'Configuration', description: 'Attendance, policies, integrations', icon: SettingsIcon },
    { settingsTab: 'knuct', label: 'Knuct', description: 'Wallet provisioning and anchors', icon: Wallet },
  ];

  return (
    <Card className="border-[#1A3C6E]/20 bg-gradient-to-br from-[#1A3C6E]/5 to-background">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-[#1A3C6E]">
          <Crown className="h-4 w-4" />
          Super Admin — full campus control
        </CardTitle>
        <CardDescription>
          You can configure every module, create all user roles (teachers, students, staff), edit system policy, RBAC, and Knuct integration from Settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Campus modules</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {modules.map((mod) => {
              const Icon = mod.icon;
              return (
                <Button
                  key={mod.section}
                  variant="outline"
                  className="h-auto flex-col items-start gap-1 p-3 text-left whitespace-normal"
                  onClick={() => onNavigate(mod.section)}
                >
                  <span className="flex items-center gap-2 font-medium text-sm">
                    <Icon className="h-4 w-4 text-[#1A3C6E] shrink-0" />
                    {mod.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-normal leading-snug">{mod.description}</span>
                </Button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Settings shortcuts</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {settingsShortcuts.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.settingsTab}
                  variant="outline"
                  className="h-auto flex-col items-start gap-1 p-3 text-left whitespace-normal border-[#1A3C6E]/30"
                  onClick={() => onNavigate('settings', { settingsTab: item.settingsTab })}
                >
                  <span className="flex items-center gap-2 font-medium text-sm">
                    <Icon className="h-4 w-4 text-[#1A3C6E] shrink-0" />
                    {item.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-normal leading-snug">{item.description}</span>
                </Button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsSection() {
  const { currentUser, setRoleSections, navigateToSection, sectionContext, setSectionContext } = useAppStore();
  const liveRoleSections = useRoleSections();
  const hasSettingsAccess = useSectionAccess('settings');
  const isAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'admin';
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const showSettingsAdminTabs = hasSettingsAccess && isAdmin;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('config');

  useEffect(() => {
    if (sectionContext?.settingsTab) {
      setActiveTab(sectionContext.settingsTab);
      setSectionContext(null);
    }
  }, [sectionContext?.settingsTab, setSectionContext]);

  const { data: configData } = useQuery<SystemConfigResponse>({
    queryKey: ['system-config'],
    queryFn: () => fetch('/api/settings/config').then((r) => {
      if (!r.ok) throw new Error('Failed to load configuration');
      return r.json();
    }),
    enabled: !!currentUser && hasSettingsAccess,
  });
  const eligibilityPct = configData?.settings?.attendance?.eligibilityPct ?? 75;

  const [auditAnchorOnly, setAuditAnchorOnly] = useState(false);
  const [draftMatrix, setDraftMatrix] = useState<Record<Role, Section[]> | null>(null);
  const [rbacDirty, setRbacDirty] = useState(false);

  const { data: rbacData, isLoading: rbacLoading } = useQuery({
    queryKey: ['rbac-config'],
    queryFn: () => fetch('/api/settings/rbac').then((r) => {
      if (!r.ok) throw new Error('Failed to load RBAC');
      return r.json() as Promise<{
        matrix: Record<Role, Section[]>;
        defaults: Record<Role, Section[]>;
        updatedAt: string | null;
        updatedBy: string | null;
      }>;
    }),
    enabled: !!currentUser && showSettingsAdminTabs,
  });

  useEffect(() => {
    if (rbacData?.matrix && !rbacDirty) {
      setDraftMatrix(rbacData.matrix);
    }
  }, [rbacData?.matrix, rbacDirty]);

  const displayMatrix = draftMatrix ?? liveRoleSections;
  const rbacChanged = useMemo(() => {
    if (!draftMatrix || !rbacData?.matrix) return false;
    return JSON.stringify(draftMatrix) !== JSON.stringify(rbacData.matrix);
  }, [draftMatrix, rbacData?.matrix]);

  const rbacSaveMutation = useMutation({
    mutationFn: async (payload: { matrix?: Record<Role, Section[]>; reset?: boolean }) => {
      const res = await fetch('/api/settings/rbac', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save RBAC');
      return json as { matrix: Record<Role, Section[]>; message: string };
    },
    onSuccess: (data) => {
      setDraftMatrix(data.matrix);
      setRoleSections(data.matrix);
      setRbacDirty(false);
      notifyRbacUpdated();
      queryClient.invalidateQueries({ queryKey: ['rbac-config'] });
      toast({ title: 'RBAC saved', description: data.message });
    },
    onError: (err: Error) => {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    },
  });

  const toggleRbacCell = (role: Role, section: Section) => {
    if (!isSuperAdmin) return;
    if (role === 'super_admin' && (section === 'dashboard' || section === 'settings')) return;
    setDraftMatrix((prev) => {
      const base = prev ?? { ...liveRoleSections };
      const current = base[role] ?? [];
      const next = current.includes(section)
        ? current.filter((s) => s !== section)
        : [...current, section];
      return { ...base, [role]: next };
    });
    setRbacDirty(true);
  };

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['audit-logs', auditAnchorOnly],
    queryFn: () => fetch(`/api/audit?limit=30${auditAnchorOnly ? '&anchorableOnly=true' : ''}`).then((r) => {
      if (!r.ok) throw new Error('Failed to load audit logs');
      return r.json();
    }),
    enabled: showSettingsAdminTabs,
  });

  const { data: knuctData, isLoading: knuctLoading, isError: knuctError, error: knuctQueryError, refetch: refetchKnuct } = useQuery({
    queryKey: ['knuct-status'],
    queryFn: () => fetch('/api/knuct').then((r) => {
      if (!r.ok) throw new Error('Failed to load Knuct status');
      return r.json();
    }),
    enabled: showSettingsAdminTabs,
    refetchInterval: (query) =>
      query.state.data?.wallet?.status === 'pending' ? 3000 : false,
  });

  const { data: knuctCapiData } = useQuery({
    queryKey: ['knuct-capi-account'],
    queryFn: () => fetch('/api/knuct/account').then((r) => {
      if (!r.ok) throw new Error('Failed to load Knuct account (complete DID auth first)');
      return r.json() as Promise<{
        sessionActive: boolean;
        accountInfo: unknown;
        dashboard: unknown;
        sessionStore: string;
      }>;
    }),
    enabled: showSettingsAdminTabs && knuctData?.wallet?.status === 'active',
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
      }).then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error((data as { error?: string }).error || 'Provisioning failed');
        return data;
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['knuct-status'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      if (data.wallet?.status === 'active') {
        toast({ title: 'Wallet provisioned', description: `DID: ${data.wallet.did?.slice(0, 20)}…` });
      } else if (data.wallet?.status === 'failed') {
        toast({ title: 'Provisioning failed', description: data.wallet.lastError ?? 'Unknown error', variant: 'destructive' });
      } else if (data.wallet?.status === 'pending' || data.queued) {
        toast({
          title: 'Provisioning started',
          description: 'Live Knuct wallet creation can take 1–2 minutes. This page will refresh automatically.',
        });
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
        <p className="text-sm text-muted-foreground mt-1">
          {isSuperAdmin
            ? 'Configure system policy, users, roles, integrations, and every campus module.'
            : 'Configure system parameters, view RBAC matrix, and manage integrations'}
        </p>
      </div>

      {isSuperAdmin && <SuperAdminControlCenter onNavigate={navigateToSection} />}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList
          className={cn(
            'grid w-full max-w-4xl h-auto',
            isSuperAdmin ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' : showSettingsAdminTabs ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' : 'grid-cols-3',
          )}
        >
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="rbac">RBAC Matrix</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="users">User Accounts</TabsTrigger>}
          {showSettingsAdminTabs && <TabsTrigger value="knuct">Knuct</TabsTrigger>}
          {showSettingsAdminTabs && <TabsTrigger value="audit">Audit Log</TabsTrigger>}
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        {/* System Configuration */}
        <TabsContent value="config" className="space-y-4">
          <ConfigurationPanel isSuperAdmin={isSuperAdmin} />
        </TabsContent>

        {/* RBAC Permission Matrix */}
        <TabsContent value="rbac" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4 text-[#1A3C6E]" /> Role & User Access Control
                  </CardTitle>
                  <CardDescription>
                    {isSuperAdmin
                      ? 'Role matrix sets defaults for each role; user overrides grant or revoke modules for individuals. Both apply to sidebar and API guards after save.'
                      : 'Navigation access per role — configured by Super Admin'}
                  </CardDescription>
                  {rbacData?.updatedAt && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Last saved: {new Date(rbacData.updatedAt).toLocaleString('en-IN')}
                      {rbacData.updatedBy ? ` · by ${rbacData.updatedBy}` : ''}
                    </p>
                  )}
                </div>
                {isSuperAdmin && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={rbacSaveMutation.isPending}
                      onClick={() => {
                        if (rbacData?.matrix) {
                          setDraftMatrix({ ...rbacData.matrix });
                          setRbacDirty(false);
                        }
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Revert draft
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={rbacSaveMutation.isPending}
                      onClick={() => rbacSaveMutation.mutate({ reset: true })}
                    >
                      Reset to factory defaults
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5 bg-[#1A3C6E] hover:bg-[#1A3C6E]/90"
                      disabled={!rbacChanged || rbacSaveMutation.isPending}
                      onClick={() => draftMatrix && rbacSaveMutation.mutate({ matrix: draftMatrix })}
                    >
                      <Save className="h-3.5 w-3.5" />
                      {rbacSaveMutation.isPending ? 'Saving…' : 'Save RBAC'}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {rbacLoading ? (
                <div className="p-6 space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
              ) : (
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
                          const hasAccess = (displayMatrix[role] ?? []).includes(mod.section);
                          const locked = role === 'super_admin' && (mod.section === 'dashboard' || mod.section === 'settings');
                          return (
                            <TableCell key={role} className="text-center">
                              {isSuperAdmin ? (
                                <button
                                  type="button"
                                  disabled={locked || rbacSaveMutation.isPending}
                                  onClick={() => toggleRbacCell(role, mod.section)}
                                  className={`mx-auto flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                                    hasAccess
                                      ? 'border-green-200 bg-green-50 hover:bg-green-100'
                                      : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                                  } ${locked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                                  title={locked ? 'Super Admin must retain this module' : hasAccess ? 'Revoke access' : 'Grant access'}
                                >
                                  {hasAccess ? (
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <XIcon className="h-4 w-4 text-gray-300" />
                                  )}
                                </button>
                              ) : hasAccess ? (
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
              )}
            </CardContent>
          </Card>

          <UserRbacOverridesPanel isSuperAdmin={isSuperAdmin} />

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

        {isSuperAdmin && (
          <TabsContent value="users" className="space-y-4">
            <UserAccountsPanel actorRole={currentUser.role} />
          </TabsContent>
        )}

        {showSettingsAdminTabs && (
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
                          knuctData?.wallet?.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                          'bg-gray-100 text-gray-600'
                        }>
                          {knuctData?.wallet?.status === 'active' ? 'active' :
                          knuctData?.wallet?.status === 'failed' ? 'failed' :
                          knuctData?.wallet?.status === 'pending' ? 'provisioning…' :
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

                    {/* DID Authentication — private share upload, runs entirely in browser */}
                    <KnuctDIDAuthPanel
                      onSuccess={() => {
                        refetchKnuct();
                        queryClient.invalidateQueries({ queryKey: ['knuct-capi-account'] });
                      }}
                    />

                    {knuctCapiData?.sessionActive && knuctCapiData.accountInfo != null && (
                      <div className="rounded-lg border p-4 space-y-2">
                        <p className="text-sm font-medium">Live Knuct account (CAPI getAccountInfo)</p>
                        <pre className="text-[10px] font-mono bg-muted/50 p-2 rounded overflow-x-auto max-h-40">
                          {JSON.stringify(knuctCapiData.accountInfo, null, 2)}
                        </pre>
                        {knuctCapiData.dashboard != null && (
                          <>
                            <p className="text-xs font-medium text-muted-foreground mt-2">Dashboard (CAPI getDashboard)</p>
                            <pre className="text-[10px] font-mono bg-muted/50 p-2 rounded overflow-x-auto max-h-32">
                              {JSON.stringify(knuctCapiData.dashboard, null, 2)}
                            </pre>
                          </>
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
                      {knuctData?.wallet?.status === 'active' && (
                        <Button size="sm" variant="outline" className="gap-2" asChild>
                          <a href="/api/knuct/privshare" download>
                            <Download className="h-3.5 w-3.5" />
                            Download private share
                          </a>
                        </Button>
                      )}
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

        {showSettingsAdminTabs && (
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
                  { rule: `Low attendance warning (< ${eligibilityPct}%)`, channels: 'In-App + Email + SMS', target: 'Student + Parent + HOD' },
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
