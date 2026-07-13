'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search, Star, Clock, ChevronRight, RotateCcw, Download, Upload,
  History, Loader2, Save, Shield,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { formatCampusCurrency, formatCampusDateTime } from '@/lib/datetime-format';
import { KnuctCampusDetailsCard } from '@/components/administration/knuct-campus-details';
import { formatTimetableDefaultsPreview } from '@/lib/settings/timetable-defaults';
import { formatCampusIdentityPreview } from '@/lib/report-brand';
import { formatIdentityModePreview, parseIdentityMode } from '@/lib/settings/identity-mode';
import { DEFAULT_ORG_SETTINGS } from '@/lib/settings/org-defaults';
import { DEFAULT_GENERAL_SETTINGS } from '@/lib/settings/general-defaults';

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

function parseWorkingDaysDraft(draft: unknown): number[] {
  if (Array.isArray(draft)) {
    return draft
      .map((d) => (typeof d === 'number' ? d : Number(d)))
      .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  }
  if (typeof draft === 'string') {
    try {
      return parseWorkingDaysDraft(JSON.parse(draft));
    } catch {
      return [1, 2, 3, 4, 5];
    }
  }
  return [1, 2, 3, 4, 5];
}

/** Compact range like Mon–Fri when contiguous, else Mon, Wed, Fri */
function formatWorkingDaysLabel(days: number[]): string {
  if (days.length === 0) return 'none';
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 1) return WEEKDAY_SHORT[sorted[0]];
  const contiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1]! + 1);
  if (contiguous) return `${WEEKDAY_SHORT[sorted[0]!]}–${WEEKDAY_SHORT[sorted[sorted.length - 1]!]}`;
  return sorted.map((d) => WEEKDAY_SHORT[d]).join(', ');
}

type EffectiveSetting = {
  key: string;
  value: unknown;
  source: string;
  version?: number;
  updatedAt?: string | null;
  layers?: { scope: string; scopeId: string; value: unknown; version?: number }[];
  definition: {
    key: string;
    category: string;
    subcategory?: string;
    displayName: string;
    description: string;
    valueType: string;
    defaultValue: unknown;
    editable?: boolean;
    envOnly?: boolean;
    allowUserOverride?: boolean;
    allowDepartmentOverride?: boolean;
    validation?: {
      allowedValues?: (string | number | boolean)[];
      optionLabels?: Record<string, string>;
      min?: number;
      max?: number;
      regex?: string;
    };
  };
};

type Category = { id: string; label: string; keys: string[] };

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

function SettingEditor({
  setting,
  draft,
  onChange,
  disabled,
}: {
  setting: EffectiveSetting;
  draft: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}) {
  const def = setting.definition;
  const type = def.valueType;

  if (type === 'boolean') {
    return (
      <div className="flex items-center gap-3">
        <Switch
          checked={Boolean(draft)}
          disabled={disabled}
          onCheckedChange={(c) => onChange(c)}
        />
        <span className="text-xs text-muted-foreground">
          {draft ? 'On — enabled' : 'Off — disabled'}
        </span>
      </div>
    );
  }

  if (type === 'enum' && def.validation?.allowedValues) {
    const labels = def.validation.optionLabels ?? {};
    return (
      <Select
        value={String(draft ?? '')}
        disabled={disabled}
        onValueChange={(v) => {
          const match = def.validation?.allowedValues?.find((x) => String(x) === v);
          onChange(match !== undefined ? match : v);
        }}
      >
        <SelectTrigger className="h-9 max-w-lg">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {def.validation.allowedValues.map((v) => (
            <SelectItem key={String(v)} value={String(v)}>
              {labels[String(v)] ?? String(v)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (type === 'number' || type === 'decimal') {
    const min = def.validation?.min;
    const max = def.validation?.max;
    const hint =
      min != null && max != null
        ? `Allowed range: ${min}–${max}`
        : min != null
          ? `Minimum: ${min}`
          : max != null
            ? `Maximum: ${max}`
            : null;
    return (
      <div className="space-y-1.5">
        <Input
          type="number"
          className="h-9 max-w-xs"
          disabled={disabled}
          value={typeof draft === 'number' ? draft : ''}
          min={min}
          max={max}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
        {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
      </div>
    );
  }

  if (def.key === 'organization.day_start_time' || def.key === 'organization.day_end_time' || def.key === 'organization.half_day_end_time') {
    const fallback =
      def.key === 'organization.day_end_time'
        ? '17:00'
        : def.key === 'organization.half_day_end_time'
          ? '13:00'
          : '08:00';
    const value = String(draft ?? fallback);
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="time"
          className="h-9 max-w-[10rem]"
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="text-[10px] text-muted-foreground font-mono">{value || 'HH:mm'}</span>
      </div>
    );
  }

  if (def.key === 'organization.working_days') {
    const selected = new Set(parseWorkingDaysDraft(draft));
    return (
      <div className="flex flex-wrap gap-2">
        {WEEKDAY_SHORT.map((label, day) => {
          const checked = selected.has(day);
          return (
            <label
              key={label}
              className={cn(
                'flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs cursor-pointer',
                checked ? 'bg-muted border-foreground/20' : 'bg-background',
                disabled && 'opacity-50 pointer-events-none',
              )}
            >
              <Checkbox
                checked={checked}
                disabled={disabled}
                onCheckedChange={(c) => {
                  const next = new Set(selected);
                  if (c) next.add(day);
                  else next.delete(day);
                  onChange([...next].sort((a, b) => a - b));
                }}
              />
              {label}
            </label>
          );
        })}
      </div>
    );
  }

  if (type === 'json') {
    return (
      <Textarea
        className="font-mono text-xs min-h-[160px]"
        disabled={disabled}
        value={typeof draft === 'string' ? draft : JSON.stringify(draft, null, 2)}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  const isHexColor =
    type === 'string' &&
    def.validation?.regex === '^#[0-9A-Fa-f]{6}$';

  if (isHexColor) {
    const hex = String(draft ?? '#000000');
    return (
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="color"
          disabled={disabled}
          value={/^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : '#1A3C6E'}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-9 w-12 cursor-pointer rounded border bg-transparent p-0.5"
          aria-label="Pick color"
        />
        <Input
          className="h-9 max-w-[8rem] font-mono uppercase"
          disabled={disabled}
          value={hex}
          placeholder="#1A3C6E"
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="text-[10px] text-muted-foreground">Hex #RRGGBB</span>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-w-md">
      <Input
        className="h-9"
        disabled={disabled}
        type={type === 'secret' ? 'password' : 'text'}
        value={String(draft ?? '')}
        onChange={(e) => onChange(e.target.value)}
      />
      {(def.key === 'general.logo_url' || def.key === 'general.favicon_url') && !disabled && (
        <LogoUploadField
          target={def.key === 'general.favicon_url' ? 'favicon' : 'logo'}
          onUploaded={(url) => onChange(url)}
        />
      )}
    </div>
  );
}

function LogoUploadField({
  target,
  onUploaded,
}: {
  target: 'logo' | 'favicon';
  onUploaded: (url: string) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label className="text-[10px] text-muted-foreground sr-only">Upload {target}</Label>
      <Input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="h-9 max-w-xs text-xs"
        disabled={busy}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          if (file.size > 2 * 1024 * 1024) {
            toast({ title: 'Image too large', description: 'Max 2 MB', variant: 'destructive' });
            return;
          }
          setBusy(true);
          try {
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = () => reject(new Error('Read failed'));
              reader.readAsDataURL(file);
            });
            const res = await fetch('/api/settings/branding/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageBase64: dataUrl, target }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Upload failed');
            onUploaded(data.url as string);
            toast({ title: `${target === 'favicon' ? 'Favicon' : 'Logo'} uploaded`, description: data.url });
            void queryClient.invalidateQueries({ queryKey: ['settings-list'] });
            void queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
          } catch (err) {
            toast({
              title: 'Upload failed',
              description: err instanceof Error ? err.message : 'Unknown error',
              variant: 'destructive',
            });
          } finally {
            setBusy(false);
          }
        }}
      />
      {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      <span className="text-[10px] text-muted-foreground">Or paste a path / https URL above, then Save</span>
    </div>
  );
}

function parseDraft(setting: EffectiveSetting, draft: unknown): unknown {
  if (setting.definition.valueType === 'json' && typeof draft === 'string') {
    return JSON.parse(draft);
  }
  if (setting.definition.valueType === 'number' || setting.definition.valueType === 'decimal') {
    if (draft === '' || draft === null || draft === undefined) throw new Error('Number required');
    return Number(draft);
  }
  return draft;
}

function SettingLivePreview({
  settingKey,
  draft,
  relatedDrafts,
}: {
  settingKey: string;
  draft: unknown;
  relatedDrafts?: Record<string, unknown>;
}) {
  const sample = new Date('2026-07-11T14:30:00');
  if (
    settingKey === 'organization.week_starts_on' ||
    settingKey === 'organization.working_days' ||
    settingKey === 'organization.holiday_block_attendance' ||
    settingKey === 'organization.day_start_time' ||
    settingKey === 'organization.day_end_time' ||
    settingKey === 'organization.half_day_end_time' ||
    settingKey === 'organization.saturday_mode' ||
    settingKey === 'organization.enforce_day_hours'
  ) {
    const weekStart =
      settingKey === 'organization.week_starts_on'
        ? Number(draft ?? 1)
        : Number(relatedDrafts?.['organization.week_starts_on'] ?? 1);
    const workingDays =
      settingKey === 'organization.working_days'
        ? parseWorkingDaysDraft(draft)
        : parseWorkingDaysDraft(relatedDrafts?.['organization.working_days'] ?? [1, 2, 3, 4, 5]);
    const dayStart =
      settingKey === 'organization.day_start_time'
        ? String(draft ?? '08:00')
        : String(relatedDrafts?.['organization.day_start_time'] ?? '08:00');
    const dayEnd =
      settingKey === 'organization.day_end_time'
        ? String(draft ?? '17:00')
        : String(relatedDrafts?.['organization.day_end_time'] ?? '17:00');
    const halfEnd =
      settingKey === 'organization.half_day_end_time'
        ? String(draft ?? '13:00')
        : String(relatedDrafts?.['organization.half_day_end_time'] ?? '13:00');
    const saturdayMode =
      settingKey === 'organization.saturday_mode'
        ? String(draft ?? 'off')
        : String(relatedDrafts?.['organization.saturday_mode'] ?? 'off');
    const saturdayLabel =
      saturdayMode === 'full'
        ? 'Sat full'
        : saturdayMode === 'half'
          ? `Sat half→${halfEnd}`
          : saturdayMode === 'alternate'
            ? 'Sat alternate'
            : 'Sat off';
    const weekLabel = WEEKDAY_FULL[Math.min(6, Math.max(0, Math.round(weekStart)))] ?? 'Monday';
    return (
      <p className="text-[11px] rounded-md border bg-muted/40 px-2.5 py-1.5 text-muted-foreground">
        Campus day:{' '}
        <span className="font-medium text-foreground">
          {dayStart}–{dayEnd}
        </span>
        {' · '}
        <span className="font-medium text-foreground">{formatWorkingDaysLabel(workingDays)}</span>
        {' · '}
        <span className="font-medium text-foreground">{saturdayLabel}</span>
        {' · '}
        Week starts <span className="font-medium text-foreground">{weekLabel}</span>
      </p>
    );
  }
  if (
    settingKey === 'organization.period_minutes' ||
    settingKey === 'organization.break_minutes' ||
    settingKey === 'organization.periods_per_day'
  ) {
    const periodMinutes =
      settingKey === 'organization.period_minutes'
        ? Number(draft ?? DEFAULT_ORG_SETTINGS.periodMinutes)
        : Number(relatedDrafts?.['organization.period_minutes'] ?? DEFAULT_ORG_SETTINGS.periodMinutes);
    const breakMinutes =
      settingKey === 'organization.break_minutes'
        ? Number(draft ?? DEFAULT_ORG_SETTINGS.breakMinutes)
        : Number(relatedDrafts?.['organization.break_minutes'] ?? DEFAULT_ORG_SETTINGS.breakMinutes);
    const periodsPerDay =
      settingKey === 'organization.periods_per_day'
        ? Number(draft ?? DEFAULT_ORG_SETTINGS.periodsPerDay)
        : Number(relatedDrafts?.['organization.periods_per_day'] ?? DEFAULT_ORG_SETTINGS.periodsPerDay);
    const dayStart = String(relatedDrafts?.['organization.day_start_time'] ?? DEFAULT_ORG_SETTINGS.dayStartTime);
    const preview = formatTimetableDefaultsPreview({
      periodMinutes,
      breakMinutes,
      periodsPerDay,
      dayStartTime: dayStart,
    });
    return (
      <p className="text-[11px] rounded-md border bg-muted/40 px-2.5 py-1.5 text-muted-foreground">
        Schedule: <span className="font-medium text-foreground">{preview}</span>
      </p>
    );
  }
  if (
    settingKey === 'organization.campus_code' ||
    settingKey === 'organization.aishe_code' ||
    settingKey === 'organization.campus_address' ||
    settingKey === 'organization.campus_phone' ||
    settingKey === 'organization.principal_title'
  ) {
    const pick = (key: string, fallback: string) =>
      String(
        (settingKey === key ? draft : relatedDrafts?.[key]) ?? fallback,
      ).trim();
    const preview = formatCampusIdentityPreview(
      {
        campusCode: pick('organization.campus_code', DEFAULT_ORG_SETTINGS.campusCode),
        aisheCode: pick('organization.aishe_code', DEFAULT_ORG_SETTINGS.aisheCode),
        campusAddress: pick('organization.campus_address', DEFAULT_ORG_SETTINGS.campusAddress),
        campusPhone: pick('organization.campus_phone', DEFAULT_ORG_SETTINGS.campusPhone),
        principalTitle: pick('organization.principal_title', DEFAULT_ORG_SETTINGS.principalTitle),
      },
      String(relatedDrafts?.['general.company_name'] ?? DEFAULT_GENERAL_SETTINGS.companyName).trim() ||
        DEFAULT_GENERAL_SETTINGS.companyName,
    );
    return (
      <p className="text-[11px] rounded-md border bg-muted/40 px-2.5 py-1.5 text-muted-foreground">
        Letterhead: <span className="font-medium text-foreground">{preview}</span>
      </p>
    );
  }
  if (settingKey === 'auth.identity_mode') {
    const mode = parseIdentityMode(draft);
    return (
      <p className="text-[11px] rounded-md border bg-muted/40 px-2.5 py-1.5 text-muted-foreground">
        Preview: <span className="font-medium text-foreground">{formatIdentityModePreview(mode)}</span>
      </p>
    );
  }
  if (settingKey === 'general.date_format' || settingKey === 'general.time_format' || settingKey === 'general.timezone' || settingKey === 'general.locale') {
    const dateFormat = settingKey === 'general.date_format' ? String(draft ?? 'dd/MM/yyyy') : 'dd/MM/yyyy';
    const timeFormat = settingKey === 'general.time_format' ? (draft === '24h' ? '24h' : '12h') : '12h';
    const timezone = settingKey === 'general.timezone' ? String(draft ?? 'Asia/Kolkata') : 'Asia/Kolkata';
    const locale = settingKey === 'general.locale' ? String(draft ?? 'en-IN') : 'en-IN';
    const preview = formatCampusDateTime(sample, {
      dateFormat,
      timeFormat,
      timezone,
      locale,
      includeTime: true,
    });
    return (
      <p className="text-[11px] rounded-md border bg-muted/40 px-2.5 py-1.5 text-muted-foreground">
        Preview: <span className="font-medium text-foreground">{preview}</span>
      </p>
    );
  }
  if (settingKey === 'general.currency') {
    const preview = formatCampusCurrency(123456.78, {
      currency: String(draft ?? 'INR'),
      locale: 'en-IN',
    });
    return (
      <p className="text-[11px] rounded-md border bg-muted/40 px-2.5 py-1.5 text-muted-foreground">
        Preview: <span className="font-medium text-foreground">{preview}</span>
      </p>
    );
  }
  if (settingKey === 'general.branding_primary_color' && typeof draft === 'string') {
    return (
      <p className="text-[11px] rounded-md border bg-muted/40 px-2.5 py-1.5 text-muted-foreground flex items-center gap-2">
        Preview accent
        <span className="inline-block h-3.5 w-3.5 rounded-sm border" style={{ backgroundColor: draft }} />
        <span className="font-mono text-foreground">{draft}</span>
      </p>
    );
  }
  return null;
}

export function SettingsWorkspace({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<string>('general');
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [editScope, setEditScope] = useState<'global' | 'department'>('global');
  const [departmentId, setDepartmentId] = useState<string>('');

  const { data: catData } = useQuery({
    queryKey: ['settings-categories'],
    queryFn: () => fetchJson<{ categories: Category[] }>('/api/settings/categories'),
  });

  const { data: deptData } = useQuery({
    queryKey: ['settings-departments'],
    queryFn: () => fetchJson<{ departments: { id: string; code: string; name: string }[] }>(
      '/api/masters/departments?limit=100&isActive=true',
    ),
    enabled: isSuperAdmin,
  });

  const { data: listData, isLoading } = useQuery({
    queryKey: ['settings-list', category, search, departmentId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (category && category !== 'favorites' && category !== 'recent') params.set('category', category);
      if (search.trim()) params.set('search', search.trim());
      if (departmentId) params.set('departmentId', departmentId);
      return fetchJson<{ settings: EffectiveSetting[] }>(`/api/settings?${params}`);
    },
    enabled: category !== 'favorites' && category !== 'recent',
  });

  const { data: runtimeMeta } = useQuery({
    queryKey: ['system-config-runtime'],
    queryFn: () => fetchJson<{
      runtime: {
        faceVerification: { enabled: boolean; apiConfigured: boolean; mode: string };
        knuct: { liveEnabled: boolean; anchorsEnabled: boolean; chainPublish: boolean };
        email: { status: string; provider: string | null };
        rateLimit: { backend: string };
        database: { provider: string };
        auth: { method: string };
        geofencing: { algorithm: string };
        sms: { configured: boolean };
      };
    }>('/api/settings/config'),
    enabled: category === 'runtime' || category === 'integrations',
  });

  const { data: favData } = useQuery({
    queryKey: ['settings-favorites'],
    queryFn: () => fetchJson<{ settings: EffectiveSetting[] }>('/api/settings/favorites'),
  });

  const { data: recentData } = useQuery({
    queryKey: ['settings-recent'],
    queryFn: () => fetchJson<{ settings: EffectiveSetting[] }>('/api/settings/recent'),
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['settings-history', selectedKey],
    queryFn: () => fetchJson<{ history: { id: string; version: number; value: unknown; createdAt: string; reason: string | null }[] }>(
      `/api/settings/history?key=${encodeURIComponent(selectedKey!)}`,
    ),
    enabled: showHistory && !!selectedKey,
  });

  const settings = useMemo(() => {
    if (category === 'favorites') return favData?.settings ?? [];
    if (category === 'recent') return recentData?.settings ?? [];
    return listData?.settings ?? [];
  }, [category, favData, recentData, listData]);

  const settingsByGroup = useMemo(() => {
    const groups: { label: string; items: EffectiveSetting[] }[] = [];
    const index = new Map<string, number>();
    for (const s of settings) {
      const label = s.definition.subcategory?.trim() || 'Other';
      const existing = index.get(label);
      if (existing === undefined) {
        index.set(label, groups.length);
        groups.push({ label, items: [s] });
      } else {
        groups[existing].items.push(s);
      }
    }
    return groups;
  }, [settings]);

  const selected = settings.find((s) => s.key === selectedKey) ?? settings[0] ?? null;
  const activeKey = selected?.key ?? null;

  const draftValue = activeKey
    ? (activeKey in drafts ? drafts[activeKey] : selected?.value)
    : undefined;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('No setting selected');
      if (editScope === 'department' && !departmentId) {
        throw new Error('Select a department for department-scoped saves');
      }
      if (editScope === 'department' && !selected.definition.allowDepartmentOverride) {
        throw new Error('This setting does not allow department overrides');
      }
      const value = parseDraft(selected, draftValue);
      return fetchJson<{ setting: EffectiveSetting }>(`/api/settings/${encodeURIComponent(selected.key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value,
          scope: editScope,
          scopeId: editScope === 'department' ? departmentId : '',
        }),
      });
    },
    onSuccess: (data) => {
      toast({
        title: 'Setting saved',
        description: `${data.setting.key} (${editScope}${editScope === 'department' ? ` · ${departmentId.slice(0, 8)}…` : ''})`,
      });
      setDrafts((d) => {
        const next = { ...d };
        delete next[data.setting.key];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['settings-list'] });
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
      queryClient.invalidateQueries({ queryKey: ['system-config'] });
      queryClient.invalidateQueries({ queryKey: ['rbac-config'] });
      queryClient.invalidateQueries({ queryKey: ['auth-identity-mode'] });
    },
    onError: (err: Error) => toast({ title: 'Save failed', description: err.message, variant: 'destructive' }),
  });

  const clearOverrideMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !departmentId) throw new Error('Department required');
      return fetchJson('/api/settings/clear-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: selected.key, scope: 'department', scopeId: departmentId }),
      });
    },
    onSuccess: () => {
      toast({ title: 'Department override cleared' });
      queryClient.invalidateQueries({ queryKey: ['settings-list'] });
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
      queryClient.invalidateQueries({ queryKey: ['system-config'] });
    },
    onError: (err: Error) => toast({ title: 'Clear failed', description: err.message, variant: 'destructive' }),
  });

  const resetMutation = useMutation({
    mutationFn: async (key: string) =>
      fetchJson('/api/settings/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      }),
    onSuccess: () => {
      toast({ title: 'Reset to default' });
      queryClient.invalidateQueries({ queryKey: ['settings-list'] });
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
      queryClient.invalidateQueries({ queryKey: ['system-config'] });
    },
    onError: (err: Error) => toast({ title: 'Reset failed', description: err.message, variant: 'destructive' }),
  });

  const favMutation = useMutation({
    mutationFn: async ({ key, add }: { key: string; add: boolean }) =>
      fetchJson('/api/settings/favorites', {
        method: add ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings-favorites'] }),
  });

  const rollbackMutation = useMutation({
    mutationFn: async ({ key, version }: { key: string; version: number }) =>
      fetchJson('/api/settings/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, version }),
      }),
    onSuccess: () => {
      toast({ title: 'Rolled back' });
      queryClient.invalidateQueries({ queryKey: ['settings-list'] });
      queryClient.invalidateQueries({ queryKey: ['settings-history'] });
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
      queryClient.invalidateQueries({ queryKey: ['system-config'] });
    },
    onError: (err: Error) => toast({ title: 'Rollback failed', description: err.message, variant: 'destructive' }),
  });

  const exportMutation = useMutation({
    mutationFn: async () => fetchJson<{ settings: Record<string, unknown>; exportedAt: string }>('/api/settings/export'),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aimscs-settings-${data.exportedAt.slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const json = JSON.parse(text);
      return fetchJson('/api/settings/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      });
    },
    onSuccess: () => {
      toast({ title: 'Settings imported' });
      queryClient.invalidateQueries({ queryKey: ['settings-list'] });
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
      queryClient.invalidateQueries({ queryKey: ['system-config'] });
      queryClient.invalidateQueries({ queryKey: ['rbac-config'] });
    },
    onError: (err: Error) => toast({ title: 'Import failed', description: err.message, variant: 'destructive' }),
  });

  const favKeys = new Set((favData?.settings ?? []).map((s) => s.key));
  const categories = catData?.categories ?? [];
  const departments = deptData?.departments ?? [];
  const canDeptOverride = Boolean(selected?.definition.allowDepartmentOverride);
  const editable = isSuperAdmin && selected && !selected.definition.envOnly && selected.definition.editable !== false
    && (editScope === 'global' || (editScope === 'department' && canDeptOverride && !!departmentId));
  const hasDeptLayer = Boolean(
    selected?.layers?.some((l) => l.scope === 'department' && l.scopeId === departmentId),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-brand flex items-center gap-2">
            <Shield className="h-5 w-5" /> Platform settings
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Centralized configuration — changes apply at runtime without restart
          </p>
        </div>
        {isSuperAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            <label>
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importMutation.mutate(f);
                  e.target.value = '';
                }}
              />
              <Button size="sm" variant="outline" className="gap-1.5" asChild disabled={importMutation.isPending}>
                <span><Upload className="h-3.5 w-3.5" /> Import</span>
              </Button>
            </label>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <Card className="h-fit">
          <CardHeader className="py-3 px-3">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="h-8 pl-7 text-xs"
                placeholder="Search settings…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-3 pt-0">
            <nav className="space-y-0.5">
              <button
                type="button"
                className={cn(
                  'w-full text-left text-xs px-2 py-1.5 rounded-md flex items-center gap-2',
                  category === 'favorites' ? 'bg-brand text-white' : 'hover:bg-muted',
                )}
                onClick={() => setCategory('favorites')}
              >
                <Star className="h-3 w-3" /> Favorites
              </button>
              <button
                type="button"
                className={cn(
                  'w-full text-left text-xs px-2 py-1.5 rounded-md flex items-center gap-2',
                  category === 'recent' ? 'bg-brand text-white' : 'hover:bg-muted',
                )}
                onClick={() => setCategory('recent')}
              >
                <Clock className="h-3 w-3" /> Recent
              </button>
              <Separator className="my-2" />
              {categories.filter((c) => c.id !== 'runtime').map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={cn(
                    'w-full text-left text-xs px-2 py-1.5 rounded-md',
                    category === c.id ? 'bg-brand text-white' : 'hover:bg-muted',
                  )}
                  onClick={() => {
                    setCategory(c.id);
                    setSelectedKey(null);
                    setShowHistory(false);
                  }}
                >
                  {c.label}
                  <span className="opacity-60 ml-1">({c.keys.length})</span>
                </button>
              ))}
              <button
                type="button"
                className={cn(
                  'w-full text-left text-xs px-2 py-1.5 rounded-md',
                  category === 'runtime' ? 'bg-brand text-white' : 'hover:bg-muted',
                )}
                onClick={() => {
                  setCategory('runtime');
                  setSelectedKey(null);
                  setShowHistory(false);
                }}
              >
                Runtime / environment
              </button>
            </nav>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span>Administration</span>
            <ChevronRight className="h-3 w-3" />
            <span>Settings</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium capitalize">{category}</span>
            {selected && (
              <>
                <ChevronRight className="h-3 w-3" />
                <span className="text-foreground font-mono">{selected.key}</span>
              </>
            )}
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
            {category === 'general' && (
              <div className="lg:col-span-2">
                <KnuctCampusDetailsCard />
              </div>
            )}
            {category === 'runtime' && (
              <Card className="lg:col-span-2">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Runtime / environment status</CardTitle>
                  <CardDescription className="text-xs">
                    Read-only snapshot. Secrets stay in environment variables.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!runtimeMeta?.runtime ? (
                    <Skeleton className="h-24 w-full" />
                  ) : (
                    <dl className="grid gap-3 sm:grid-cols-2 text-xs">
                      {[
                        ['Face verification', `${runtimeMeta.runtime.faceVerification.mode} (api: ${runtimeMeta.runtime.faceVerification.apiConfigured ? 'yes' : 'no'})`],
                        ['Knuct live', runtimeMeta.runtime.knuct.liveEnabled ? 'on' : 'off'],
                        ['Knuct anchors', runtimeMeta.runtime.knuct.anchorsEnabled ? 'on' : 'off'],
                        ['Chain publish', runtimeMeta.runtime.knuct.chainPublish ? 'on' : 'off'],
                        ['Email', `${runtimeMeta.runtime.email.status}${runtimeMeta.runtime.email.provider ? ` · ${runtimeMeta.runtime.email.provider}` : ''}`],
                        ['SMS', runtimeMeta.runtime.sms.configured ? 'configured' : 'not configured'],
                        ['Rate limit', runtimeMeta.runtime.rateLimit.backend],
                        ['Database', runtimeMeta.runtime.database.provider],
                        ['Auth', runtimeMeta.runtime.auth.method],
                        ['Geofencing', runtimeMeta.runtime.geofencing.algorithm],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-md border px-3 py-2">
                          <dt className="text-muted-foreground">{label}</dt>
                          <dd className="font-medium mt-0.5">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </CardContent>
              </Card>
            )}
            <>
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">
                  {category === 'general'
                    ? 'Campus & experience'
                    : category === 'organization'
                      ? 'Campus calendar, identity & academic rules'
                      : 'Settings'}
                </CardTitle>
                <CardDescription className="text-xs">
                  {category === 'general'
                    ? 'Branding, regional formats, home screen, and access'
                    : category === 'organization'
                      ? 'Week start, working days, campus identity for reports, and academic-year requirements'
                      : `${settings.length} option${settings.length === 1 ? '' : 's'}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[420px]">
                  {isLoading && category !== 'favorites' && category !== 'recent' ? (
                    <div className="p-3 space-y-2">
                      {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                  ) : settings.length === 0 ? (
                    <p className="p-4 text-xs text-muted-foreground">No settings in this view.</p>
                  ) : (
                    <div>
                      {settingsByGroup.map((group) => (
                        <div key={group.label}>
                          {(settingsByGroup.length > 1 || group.label !== 'Other') && (
                            <p className="sticky top-0 z-[1] bg-muted/80 backdrop-blur px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-b">
                              {group.label}
                            </p>
                          )}
                          <ul className="divide-y">
                            {group.items.map((s) => (
                              <li key={s.key}>
                                <button
                                  type="button"
                                  className={cn(
                                    'w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors',
                                    activeKey === s.key && 'bg-muted',
                                  )}
                                  onClick={() => {
                                    setSelectedKey(s.key);
                                    setShowHistory(false);
                                  }}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-xs font-medium truncate">{s.definition.displayName}</p>
                                      <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                                        {s.definition.description}
                                      </p>
                                    </div>
                                    <Badge variant="outline" className="text-[9px] shrink-0">{s.source}</Badge>
                                  </div>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3">
                {selected ? (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-sm">{selected.definition.displayName}</CardTitle>
                        <CardDescription className="text-xs mt-1">{selected.definition.description}</CardDescription>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => favMutation.mutate({ key: selected.key, add: !favKeys.has(selected.key) })}
                      >
                        <Star className={cn('h-4 w-4', favKeys.has(selected.key) && 'fill-amber-400 text-amber-500')} />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {selected.definition.subcategory && (
                        <Badge variant="secondary" className="text-[10px]">{selected.definition.subcategory}</Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] font-mono" title={selected.key}>
                        {selected.key}
                      </Badge>
                      {selected.definition.envOnly && <Badge className="text-[10px] bg-amber-100 text-amber-800">env only</Badge>}
                      {selected.definition.allowDepartmentOverride && (
                        <Badge variant="outline" className="text-[10px]">dept override</Badge>
                      )}
                      {selected.definition.allowUserOverride && (
                        <Badge variant="outline" className="text-[10px]">user override</Badge>
                      )}
                    </div>
                  </>
                ) : (
                  <CardTitle className="text-sm">Select a setting</CardTitle>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {!selected ? (
                  <p className="text-xs text-muted-foreground">Choose a key from the list.</p>
                ) : (
                  <>
                    {isSuperAdmin && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Edit scope</Label>
                          <Select
                            value={editScope}
                            onValueChange={(v) => setEditScope(v as 'global' | 'department')}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="global">Global</SelectItem>
                              <SelectItem value="department" disabled={!canDeptOverride}>
                                Department{!canDeptOverride ? ' (not allowed)' : ''}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Department</Label>
                          <Select
                            value={departmentId || '__none__'}
                            onValueChange={(v) => setDepartmentId(v === '__none__' ? '' : v)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">None (preview global)</SelectItem>
                              {departments.map((d) => (
                                <SelectItem key={d.id} value={d.id}>
                                  {d.code} — {d.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {(selected.layers?.length ?? 0) > 0 && (
                      <div className="rounded-md border px-3 py-2 space-y-1">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Resolution layers</p>
                        <ul className="space-y-1">
                          {selected.layers!.map((l, i) => (
                            <li key={`${l.scope}-${l.scopeId}-${i}`} className="flex justify-between gap-2 text-[10px] font-mono">
                              <span>{l.scope}{l.scopeId ? `:${l.scopeId.slice(0, 8)}` : ''}</span>
                              <span className="truncate opacity-80">{JSON.stringify(l.value)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-xs">Value</Label>
                      <SettingEditor
                        setting={selected}
                        draft={draftValue}
                        disabled={!editable}
                        onChange={(v) => setDrafts((d) => ({ ...d, [selected.key]: v }))}
                      />
                      <SettingLivePreview
                        settingKey={selected.key}
                        draft={draftValue}
                        relatedDrafts={{
                          'organization.week_starts_on':
                            drafts['organization.week_starts_on'] ??
                            settings.find((s) => s.key === 'organization.week_starts_on')?.value,
                          'organization.working_days':
                            drafts['organization.working_days'] ??
                            settings.find((s) => s.key === 'organization.working_days')?.value,
                          'organization.day_start_time':
                            drafts['organization.day_start_time'] ??
                            settings.find((s) => s.key === 'organization.day_start_time')?.value,
                          'organization.day_end_time':
                            drafts['organization.day_end_time'] ??
                            settings.find((s) => s.key === 'organization.day_end_time')?.value,
                          'organization.half_day_end_time':
                            drafts['organization.half_day_end_time'] ??
                            settings.find((s) => s.key === 'organization.half_day_end_time')?.value,
                          'organization.saturday_mode':
                            drafts['organization.saturday_mode'] ??
                            settings.find((s) => s.key === 'organization.saturday_mode')?.value,
                          'organization.period_minutes':
                            drafts['organization.period_minutes'] ??
                            settings.find((s) => s.key === 'organization.period_minutes')?.value,
                          'organization.break_minutes':
                            drafts['organization.break_minutes'] ??
                            settings.find((s) => s.key === 'organization.break_minutes')?.value,
                          'organization.periods_per_day':
                            drafts['organization.periods_per_day'] ??
                            settings.find((s) => s.key === 'organization.periods_per_day')?.value,
                          'organization.campus_code':
                            drafts['organization.campus_code'] ??
                            settings.find((s) => s.key === 'organization.campus_code')?.value,
                          'organization.aishe_code':
                            drafts['organization.aishe_code'] ??
                            settings.find((s) => s.key === 'organization.aishe_code')?.value,
                          'organization.campus_address':
                            drafts['organization.campus_address'] ??
                            settings.find((s) => s.key === 'organization.campus_address')?.value,
                          'organization.campus_phone':
                            drafts['organization.campus_phone'] ??
                            settings.find((s) => s.key === 'organization.campus_phone')?.value,
                          'organization.principal_title':
                            drafts['organization.principal_title'] ??
                            settings.find((s) => s.key === 'organization.principal_title')?.value,
                          'general.company_name':
                            drafts['general.company_name'] ??
                            settings.find((s) => s.key === 'general.company_name')?.value ??
                            DEFAULT_GENERAL_SETTINGS.companyName,
                        }}
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Effective source: <code className="font-mono">{selected.source}</code>
                        {' · '}Default:{' '}
                        <code className="font-mono">
                          {selected.definition.validation?.optionLabels?.[String(selected.definition.defaultValue)]
                            ?? JSON.stringify(selected.definition.defaultValue)}
                        </code>
                        {selected.version != null && ` · v${selected.version}`}
                      </p>
                    </div>

                    {isSuperAdmin && (
                      <div className="flex flex-wrap gap-2 pt-2 border-t">
                        <Button
                          size="sm"
                          className="gap-1.5 bg-brand hover:bg-brand/90"
                          disabled={!editable || saveMutation.isPending}
                          onClick={() => saveMutation.mutate()}
                        >
                          {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                          Save {editScope === 'department' ? 'dept override' : 'global'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          disabled={!editable || editScope !== 'global' || resetMutation.isPending}
                          onClick={() => resetMutation.mutate(selected.key)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Reset global
                        </Button>
                        {canDeptOverride && departmentId && hasDeptLayer && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            disabled={clearOverrideMutation.isPending}
                            onClick={() => clearOverrideMutation.mutate()}
                          >
                            Clear dept override
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5"
                          onClick={() => setShowHistory((h) => !h)}
                        >
                          <History className="h-3.5 w-3.5" /> History
                        </Button>
                      </div>
                    )}

                    {showHistory && (
                      <div className="rounded-lg border p-3 space-y-2">
                        <p className="text-xs font-medium">Version history</p>
                        {historyLoading ? (
                          <Skeleton className="h-16 w-full" />
                        ) : (historyData?.history?.length ?? 0) === 0 ? (
                          <p className="text-[10px] text-muted-foreground">No history yet.</p>
                        ) : (
                          <ul className="space-y-2 max-h-48 overflow-y-auto">
                            {historyData!.history.map((h) => (
                              <li key={h.id} className="flex items-start justify-between gap-2 text-[10px]">
                                <div className="min-w-0">
                                  <p className="font-mono">v{h.version} · {h.reason ?? 'change'}</p>
                                  <p className="text-muted-foreground truncate">{new Date(h.createdAt).toLocaleString()}</p>
                                  <p className="font-mono truncate opacity-70">{JSON.stringify(h.value)}</p>
                                </div>
                                {isSuperAdmin && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[10px]"
                                    disabled={rollbackMutation.isPending}
                                    onClick={() => rollbackMutation.mutate({ key: selected.key, version: h.version })}
                                  >
                                    Restore
                                  </Button>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
            </>
          </div>
        </div>
      </div>
    </div>
  );
}
