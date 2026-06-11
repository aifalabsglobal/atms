'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users, Search, Filter, Shield, UserCheck, UserX, ChevronLeft,
  ChevronRight, Eye, MoreHorizontal, Mail, Phone, Building2,
  Clock, CheckCircle2, XCircle, AlertTriangle, ShieldCheck,
  GraduationCap, FlaskConical, BookOpen, MapPin, ClipboardList,
  FileText, BarChart3, Settings, Lock, Award, UserCog
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserItem } from '@/lib/types';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Pie, PieChart, Cell } from 'recharts';

// ─── Constants ───────────────────────────────────────────────────────────────

const UOH_NAVY = '#1A3C6E';

const ROLES = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'hod', label: 'HOD' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'lab_assistant', label: 'Lab Assistant' },
  { value: 'student', label: 'Student' },
  { value: 'parent', label: 'Parent' },
  { value: 'visitor', label: 'Visitor' },
  { value: 'security', label: 'Security' },
] as const;

const ROLE_BADGE_STYLES: Record<string, string> = {
  super_admin: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  admin: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
  hod: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
  faculty: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  lab_assistant: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800',
  student: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  parent: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  visitor: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800/30 dark:text-gray-300 dark:border-gray-700',
  security: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800',
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: '#DC2626',
  admin: '#EA580C',
  hod: '#9333EA',
  faculty: '#2563EB',
  lab_assistant: '#0D9488',
  student: '#16A34A',
  parent: '#D97706',
  visitor: '#6B7280',
  security: '#E11D48',
};

const STATUS_BADGE_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  inactive: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:border-gray-700',
  suspended: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  active: CheckCircle2,
  inactive: XCircle,
  suspended: AlertTriangle,
};

const DEPARTMENTS = [
  'Computer Science',
  'Electronics & Communication',
  'Physics',
  'Chemistry',
  'Mathematics',
  'Life Sciences',
  'IT Department',
  'Administration',
  'Library',
  'Security Office',
];

const CHART_CONFIG: ChartConfig = {
  super_admin: { label: 'Super Admin', color: '#DC2626' },
  admin: { label: 'Admin', color: '#EA580C' },
  hod: { label: 'HOD', color: '#9333EA' },
  faculty: { label: 'Faculty', color: '#2563EB' },
  lab_assistant: { label: 'Lab Assistant', color: '#0D9488' },
  student: { label: 'Student', color: '#16A34A' },
  parent: { label: 'Parent', color: '#D97706' },
  visitor: { label: 'Visitor', color: '#6B7280' },
  security: { label: 'Security', color: '#E11D48' },
};

// Permission matrix: key modules × 9 roles
const PERMISSION_MODULES = [
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { key: 'attendance', label: 'Attendance', icon: ClipboardList },
  { key: 'lms', label: 'Learning Mgmt', icon: BookOpen },
  { key: 'users', label: 'User Mgmt', icon: Users },
  { key: 'violations', label: 'Violations', icon: Shield },
  { key: 'reports', label: 'Reports', icon: FileText },
  { key: 'geofences', label: 'Geofences', icon: MapPin },
  { key: 'settings', label: 'Settings', icon: Settings },
] as const;

// Permission levels: full=✓, view=◐, none=✗
const PERMISSION_MATRIX: Record<string, Record<string, '✓' | '◐' | '✗'>> = {
  super_admin: { dashboard: '✓', attendance: '✓', lms: '✓', users: '✓', violations: '✓', reports: '✓', geofences: '✓', settings: '✓' },
  admin:       { dashboard: '✓', attendance: '✓', lms: '✓', users: '✓', violations: '✓', reports: '✓', geofences: '✓', settings: '◐' },
  hod:         { dashboard: '✓', attendance: '✓', lms: '✓', users: '◐', violations: '✓', reports: '✓', geofences: '◐', settings: '✗' },
  faculty:     { dashboard: '✓', attendance: '✓', lms: '✓', users: '✗', violations: '◐', reports: '◐', geofences: '✗', settings: '✗' },
  lab_assistant: { dashboard: '✓', attendance: '✓', lms: '◐', users: '✗', violations: '✗', reports: '◐', geofences: '✗', settings: '✗' },
  student:     { dashboard: '✓', attendance: '◐', lms: '✓', users: '✗', violations: '✗', reports: '✗', geofences: '✗', settings: '✗' },
  parent:      { dashboard: '✓', attendance: '◐', lms: '◐', users: '✗', violations: '✗', reports: '✗', geofences: '✗', settings: '✗' },
  visitor:     { dashboard: '◐', attendance: '✗', lms: '✗', users: '✗', violations: '✗', reports: '✗', geofences: '✗', settings: '✗' },
  security:    { dashboard: '✓', attendance: '✓', lms: '✗', users: '✗', violations: '✓', reports: '◐', geofences: '✓', settings: '✗' },
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface UsersApiResponse {
  users: UserItem[];
  total: number;
  roleDistribution: { role: string; _count: number }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRoleLabel(role: string): string {
  return ROLES.find(r => r.value === role)?.label ?? role;
}

function formatLastLogin(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  return (
    <Badge variant="outline" className={cn('text-[10px] font-semibold px-1.5 py-0', ROLE_BADGE_STYLES[role] || 'bg-gray-100 text-gray-800')}>
      {formatRoleLabel(role)}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const Icon = STATUS_ICONS[status] || XCircle;
  return (
    <Badge variant="outline" className={cn('text-[10px] font-semibold px-1.5 py-0 gap-1', STATUS_BADGE_STYLES[status] || 'bg-gray-100')}>
      <Icon className="h-2.5 w-2.5" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function StatCard({ title, value, icon: Icon, color, subtitle }: {
  title: string; value: number; icon: React.ElementType; color: string; subtitle?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute top-0 right-0 w-16 h-16 rounded-bl-[2rem] opacity-10" style={{ backgroundColor: color }} />
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold mt-1" style={{ color }}>{value.toLocaleString()}</p>
            {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UserDetailDialog({ user, open, onOpenChange }: {
  user: UserItem | null; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border-2" style={{ borderColor: UOH_NAVY }}>
              {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
              <AvatarFallback className="text-sm font-bold" style={{ backgroundColor: `${UOH_NAVY}20`, color: UOH_NAVY }}>
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div>{user.name}</div>
              <div className="text-sm font-normal text-muted-foreground">{user.email}</div>
            </div>
          </DialogTitle>
          <DialogDescription>User profile and account details</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Role & Status */}
          <div className="flex items-center gap-2">
            <RoleBadge role={user.role} />
            <StatusBadge status={user.status} />
          </div>

          <Separator />

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Award className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground">Employee ID</p>
                <p className="font-medium">{user.employeeId || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground">Department</p>
                <p className="font-medium">{user.department || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground">Phone</p>
                <p className="font-medium">{user.phone || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground">Last Login</p>
                <p className="font-medium">{formatLastLogin(user.lastLoginAt)}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Activity Counts */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Activity Summary</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                <p className="text-lg font-bold" style={{ color: UOH_NAVY }}>{user._count.attendanceRecords}</p>
                <p className="text-[10px] text-muted-foreground">Attendance Records</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                <p className="text-lg font-bold" style={{ color: UOH_NAVY }}>{user._count.courseEnrollments}</p>
                <p className="text-[10px] text-muted-foreground">Course Enrollments</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                <p className="text-lg font-bold" style={{ color: UOH_NAVY }}>{user._count.submissions}</p>
                <p className="text-[10px] text-muted-foreground">Submissions</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                <p className="text-lg font-bold" style={{ color: UOH_NAVY }}>{user._count.taughtCourses}</p>
                <p className="text-[10px] text-muted-foreground">Courses Taught</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Account Info */}
          <div className="text-[10px] text-muted-foreground">
            Account created: {new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PermissionMatrixCard() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" style={{ color: UOH_NAVY }} />
          Permission Matrix
        </CardTitle>
        <CardDescription className="text-[10px]">
          Access control across 9 roles × key modules (✓ Full · ◐ View · ✗ None)
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 pb-3">
        <ScrollArea className="w-full">
          <div className="min-w-[540px]">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b">
                  <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground sticky left-0 bg-card z-10 min-w-[100px]">Module</th>
                  {ROLES.map(r => (
                    <th key={r.value} className="px-1.5 py-1.5 font-semibold text-center min-w-[48px]" style={{ color: ROLE_COLORS[r.value] }}>
                      {r.label.length > 6 ? r.label.slice(0, 5) + '.' : r.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_MODULES.map(mod => {
                  const ModIcon = mod.icon;
                  return (
                    <tr key={mod.key} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-1.5 font-medium flex items-center gap-1.5 sticky left-0 bg-card z-10">
                        <ModIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                        {mod.label}
                      </td>
                      {ROLES.map(r => {
                        const perm = PERMISSION_MATRIX[r.value]?.[mod.key] || '✗';
                        return (
                          <td key={r.value} className="px-1.5 py-1.5 text-center">
                            <span className={cn(
                              'inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold',
                              perm === '✓' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                              perm === '◐' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                              perm === '✗' && 'bg-red-50 text-red-400 dark:bg-red-900/20 dark:text-red-500',
                            )}>
                              {perm}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ─── Loading Skeletons ───────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-48 w-full rounded-lg" />
      <div className="grid grid-cols-1 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function UsersSection() {
  // Filter state
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Dialog state
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Build query params
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (search.trim()) params.set('search', search.trim());
    if (roleFilter && roleFilter !== 'all') params.set('role', roleFilter);
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
    if (departmentFilter && departmentFilter !== 'all') params.set('department', departmentFilter);
    return params.toString();
  }, [search, roleFilter, statusFilter, departmentFilter, page]);

  // Fetch data
  const { data, isLoading, isError } = useQuery<UsersApiResponse>({
    queryKey: ['users', queryParams],
    queryFn: () => fetch(`/api/users?${queryParams}`).then(r => {
      if (!r.ok) throw new Error('Failed to fetch users');
      return r.json();
    }),
    placeholderData: (prev) => prev,
  });

  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const roleDistribution = data?.roleDistribution ?? [];
  const totalPages = Math.ceil(total / limit);

  // Derived stats
  const activeCount = useMemo(() => users.filter(u => u.status === 'active').length, [users]);
  const suspendedCount = useMemo(() => users.filter(u => u.status === 'suspended').length, [users]);

  // Department breakdown from user data
  const deptBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    users.forEach(u => {
      if (u.department) {
        map[u.department] = (map[u.department] || 0) + 1;
      }
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [users]);

  // Pie chart data
  const pieData = useMemo(() => {
    return roleDistribution.map(r => ({
      role: r.role,
      label: formatRoleLabel(r.role),
      count: r._count,
      fill: ROLE_COLORS[r.role] || '#6B7280',
    }));
  }, [roleDistribution]);

  // Handle row click
  const handleRowClick = (user: UserItem) => {
    setSelectedUser(user);
    setDialogOpen(true);
  };

  // Reset filters
  const resetFilters = () => {
    setSearch('');
    setRoleFilter('all');
    setStatusFilter('all');
    setDepartmentFilter('all');
    setPage(1);
  };

  const hasActiveFilters = search || roleFilter !== 'all' || statusFilter !== 'all' || departmentFilter !== 'all';

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: UOH_NAVY }}>
            <Users className="h-5 w-5" />
            Users & RBAC
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage users, roles, and permissions across the campus system
          </p>
        </div>
        <Badge variant="outline" className="w-fit text-xs font-semibold" style={{ borderColor: UOH_NAVY, color: UOH_NAVY }}>
          9-Role RBAC System
        </Badge>
      </div>

      {/* Main Layout: Two columns on desktop */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* ── Left Column: Users Table ── */}
        <div className="xl:col-span-2 space-y-3">
          {/* Filter Bar */}
          <Card>
            <CardContent className="p-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, or ID..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="pl-9 h-9 text-sm"
                  />
                </div>
                <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[150px] h-9 text-xs">
                    <Filter className="h-3.5 w-3.5 mr-1" />
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {ROLES.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[130px] h-9 text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={departmentFilter} onValueChange={(v) => { setDepartmentFilter(v); setPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[170px] h-9 text-xs">
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {DEPARTMENTS.map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 text-xs text-muted-foreground">
                    Clear
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Users Table */}
          <Card>
            <CardContent className="p-0">
              {isError ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertTriangle className="h-10 w-10 text-destructive mb-3" />
                  <p className="text-sm font-medium text-destructive">Failed to load users</p>
                  <p className="text-xs text-muted-foreground mt-1">Please try again later</p>
                </div>
              ) : isLoading ? (
                <div className="p-4">
                  <TableSkeleton />
                </div>
              ) : users.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No users found</p>
                  <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="w-[240px]">User</TableHead>
                          <TableHead>Employee ID</TableHead>
                          <TableHead className="hidden md:table-cell">Department</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="hidden lg:table-cell">Last Login</TableHead>
                          <TableHead className="w-[50px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map(user => (
                          <TableRow
                            key={user.id}
                            className="cursor-pointer hover:bg-muted/40 transition-colors"
                            onClick={() => handleRowClick(user)}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2.5">
                                <Avatar className="h-8 w-8 border shrink-0" style={{ borderColor: ROLE_COLORS[user.role] || UOH_NAVY }}>
                                  {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                                  <AvatarFallback className="text-[10px] font-bold" style={{ backgroundColor: `${ROLE_COLORS[user.role] || UOH_NAVY}20`, color: ROLE_COLORS[user.role] || UOH_NAVY }}>
                                    {getInitials(user.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{user.name}</p>
                                  <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs font-mono text-muted-foreground">{user.employeeId || '—'}</span>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <span className="text-xs truncate max-w-[140px] block">{user.department || '—'}</span>
                            </TableCell>
                            <TableCell>
                              <RoleBadge role={user.role} />
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={user.status} />
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <span className="text-xs text-muted-foreground">{formatLastLogin(user.lastLoginAt)}</span>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRowClick(user); }}>
                                    <Eye className="mr-2 h-3.5 w-3.5" /> View Profile
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                                    <UserCog className="mr-2 h-3.5 w-3.5" /> Edit Role
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                                    <Mail className="mr-2 h-3.5 w-3.5" /> Send Email
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                                    <Lock className="mr-2 h-3.5 w-3.5" /> Reset Password
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total} users
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline" size="icon" className="h-7 w-7"
                        disabled={page <= 1}
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (page <= 3) {
                          pageNum = i + 1;
                        } else if (page >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = page - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={pageNum === page ? 'default' : 'outline'}
                            size="icon"
                            className={cn('h-7 w-7 text-xs', pageNum === page && 'pointer-events-none')}
                            style={pageNum === page ? { backgroundColor: UOH_NAVY } : {}}
                            onClick={() => setPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                      <Button
                        variant="outline" size="icon" className="h-7 w-7"
                        disabled={page >= totalPages}
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right Column: Stats Panel ── */}
        <div className="space-y-4">
          {/* Role Distribution Pie Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4" style={{ color: UOH_NAVY }} />
                Role Distribution
              </CardTitle>
              <CardDescription className="text-[10px]">Users by role assignment</CardDescription>
            </CardHeader>
            <CardContent className="pb-2">
              {isLoading ? (
                <Skeleton className="h-48 w-full rounded-lg" />
              ) : pieData.length > 0 ? (
                <ChartContainer config={CHART_CONFIG} className="mx-auto aspect-square max-h-[220px]">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="role" hideLabel />} />
                    <Pie
                      data={pieData}
                      dataKey="count"
                      nameKey="role"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={2}
                      strokeWidth={1}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} stroke={entry.fill} />
                      ))}
                    </Pie>
                    <ChartLegend
                      content={<ChartLegendContent nameKey="role" />}
                      className="flex-wrap gap-x-3 gap-y-1 text-[9px]"
                    />
                  </PieChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-1 gap-3">
            <StatCard
              title="Total Users"
              value={total}
              icon={Users}
              color={UOH_NAVY}
              subtitle="All registered users"
            />
            <StatCard
              title="Active Users"
              value={activeCount}
              icon={UserCheck}
              color="#16A34A"
              subtitle="Currently active"
            />
            <StatCard
              title="Suspended"
              value={suspendedCount}
              icon={UserX}
              color="#DC2626"
              subtitle="Suspended accounts"
            />
          </div>

          {/* Department Breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4" style={{ color: UOH_NAVY }} />
                Department Breakdown
              </CardTitle>
              <CardDescription className="text-[10px]">Users per department</CardDescription>
            </CardHeader>
            <CardContent className="pb-3">
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-6 w-full rounded" />
                  ))}
                </div>
              ) : deptBreakdown.length > 0 ? (
                <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                  {deptBreakdown.map(([dept, count]) => {
                    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={dept} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="truncate mr-2 font-medium">{dept}</span>
                          <span className="text-muted-foreground shrink-0">{count} ({percentage}%)</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%`, backgroundColor: UOH_NAVY }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">No department data</p>
              )}
            </CardContent>
          </Card>

          {/* Permission Matrix */}
          <PermissionMatrixCard />
        </div>
      </div>

      {/* User Detail Dialog */}
      <UserDetailDialog user={selectedUser} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
