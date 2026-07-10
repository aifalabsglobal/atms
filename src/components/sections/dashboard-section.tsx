'use client';

import { useAppStore, ROLE_LABELS, type Role } from '@/lib/store';
import { cn } from '@/lib/utils';
import type { GeofenceItem } from '@/lib/types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { BrandLogo } from '@/components/brand-logo';
import { MyKnuctWalletPanel } from '@/components/knuct/my-knuct-wallet-panel';
import {
  Users, GraduationCap, BookOpen, ScanLine, Activity,
  ShieldAlert, UserPlus, ArrowUpRight, ArrowDownRight,
  Clock, MapPin, Fingerprint, Camera, QrCode, Hand,
  AlertTriangle, RefreshCw, Calendar, ClipboardCheck,
  TrendingUp, FileText, Award, Bell, Eye, Radio,
  Building2, Wifi, ShieldCheck, CheckCircle2, XCircle,
  Timer, BookMarked,   BarChart2, Target, Download, Link2, Wallet,
} from 'lucide-react';
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
  ChartLegend, ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  PieChart, Pie, Cell, ResponsiveContainer,
  Tooltip as RechartsTooltip, LineChart, Line,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardStats {
  totalStudents: number;
  totalFaculty: number;
  totalCourses: number;
  totalSessions: number;
  activeSessions: number;
  pendingViolations: number;
  totalEnrollments: number;
  overallAttendance: number;
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
}

interface CourseAttendance {
  id: string;
  name: string;
  code: string;
  attendance: number;
  expected: number;
  percentage: number;
}

interface WeeklyTrend {
  date: string;
  present: number;
  absent: number;
  late: number;
  rate?: number;
}

interface DashboardAnalytics {
  atRiskCount: number;
  avgGradePct: number;
  quizAttempts: number;
  avgQuizScore: number;
  submissions: number;
  weeklyRateTrend: { week: string; present: number; absent: number; late: number; sessions: number; rate: number }[];
  departmentAnalytics: { department: string; students: number; avgAttendance: number; atRisk: number }[];
  atRiskStudents: { id: string; name: string; employeeId: string | null; department: string | null; stats: { percentage: number; total: number } }[];
  topPerformers: { id: string; name: string; employeeId: string | null; department: string | null; stats: { percentage: number; total: number } }[];
}

interface RecentActivity {
  id: string;
  status: string;
  captureMethod: string;
  markedAt: string;
  student: { name: string; department: string };
  session: { course: { name: string; code: string }; sessionDate: string };
}

interface ActiveSession {
  id: string;
  sessionDate: string;
  startTime: string;
  captureMethod: string;
  expectedCount: number;
  presentCount: number;
  timetableSlotId: string | null;
  course: { name: string; code: string };
  creator: { name: string };
  geofence: { name: string } | null;
  timetableSlot: { roomNumber: string; building: string } | null;
}

interface KnuctDashboardStats {
  enabled: boolean;
  adapterMode: 'mock' | 'live';
  health: 'ok' | 'degraded' | 'down' | 'unknown';
  circuitBreakerOpen: boolean;
  wallets: { total: number; active: number; failed: number; pending: number };
  didCoveragePct: number;
  credentials: { today: number; week: number; failed: number; byType: Record<string, number> };
  anchors: { today: number; byModule: Record<string, number> };
  recentActivity: Array<{ type: 'anchor' | 'credential'; module: string; ref: string; at: string }>;
}

interface DashboardData {
  scope?: 'student' | 'parent' | 'campus' | 'department' | 'instructor' | 'visitor';
  scopeLabel?: string;
  analyticsScope?: 'campus' | 'department' | 'instructor';
  riskStatus?: 'on_track' | 'watch' | 'at_risk' | 'no_data';
  analytics?: DashboardAnalytics;
  knuct?: KnuctDashboardStats;
  weeklyRateTrend?: { week: string; present: number; absent: number; late: number; sessions: number; rate: number }[];
  ward?: { id: string; name: string; department: string | null; employeeId: string | null };
  stats: DashboardStats;
  courseAttendance: CourseAttendance[];
  captureMethods: Record<string, number>;
  weeklyTrend: WeeklyTrend[];
  recentActivity: RecentActivity[];
  activeSessionsList: ActiveSession[];
  deptAttendance: { department: string; students: number }[];
  violationByType: Record<string, number>;
  violationBySeverity: Record<string, number>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const NAVY = '#1A3C6E';

const captureMethodConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  face: { label: 'Face Recognition', color: '#1A3C6E', icon: Camera },
  manual: { label: 'Manual', color: '#4A90D9', icon: Hand },
  gps: { label: 'GPS', color: '#2ECC71', icon: MapPin },
  qrcode: { label: 'QR Code', color: '#E67E22', icon: QrCode },
  biometric: { label: 'Biometric', color: '#9B59B6', icon: Fingerprint },
};

const captureChartConfig: ChartConfig = {
  face: { label: 'Face Recognition', color: '#1A3C6E' },
  manual: { label: 'Manual', color: '#4A90D9' },
  gps: { label: 'GPS', color: '#2ECC71' },
  qrcode: { label: 'QR Code', color: '#E67E22' },
  biometric: { label: 'Biometric', color: '#9B59B6' },
};

const weeklyChartConfig: ChartConfig = {
  present: { label: 'Present', color: '#2ECC71' },
  absent: { label: 'Absent', color: '#E74C3C' },
  late: { label: 'Late', color: '#F39C12' },
};

const courseChartConfig: ChartConfig = {
  percentage: { label: 'Attendance %', color: '#1A3C6E' },
};

const violationChartConfig: ChartConfig = {
  count: { label: 'Violations', color: '#E74C3C' },
};

const ROLE_COLORS: Record<Role, string> = {
  super_admin: '#1A3C6E',
  admin: '#2C5F8A',
  hod: '#1B6B4A',
  faculty: '#7C3AED',
  lab_assistant: '#B45309',
  student: '#0E7490',
  parent: '#BE185D',
  visitor: '#6B7280',
  security: '#991B1B',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  try { return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }); }
  catch { return dateStr; }
}

function formatTime(dateStr: string) {
  try { return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'present': return 'bg-green-500/10 text-green-700 border-green-200 dark:text-green-400 dark:border-green-800';
    case 'absent': return 'bg-red-500/10 text-red-700 border-red-200 dark:text-red-400 dark:border-red-800';
    case 'late': return 'bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-400 dark:border-amber-800';
    default: return 'bg-muted text-muted-foreground';
  }
}

function getMethodIcon(method: string) {
  return captureMethodConfig[method]?.icon || Hand;
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'high': return 'bg-red-500/10 text-red-700 border-red-200 dark:text-red-400';
    case 'medium': return 'bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-400';
    case 'low': return 'bg-green-500/10 text-green-700 border-green-200 dark:text-green-400';
    case 'critical': return 'bg-red-500/20 text-red-800 border-red-300 dark:text-red-300';
    default: return 'bg-muted text-muted-foreground';
  }
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="gap-4 py-4">
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-8 w-20 mt-3" />
              <Skeleton className="h-3 w-24 mt-1" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
            <CardContent><Skeleton className="h-64 w-full" /></CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Error State ─────────────────────────────────────────────────────────────

function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <div className="text-center space-y-1">
        <h3 className="text-lg font-semibold">Failed to load dashboard</h3>
        <p className="text-sm text-muted-foreground">There was an error fetching the dashboard data. Please try again.</p>
      </div>
      <Button variant="outline" onClick={onRetry} className="gap-2">
        <RefreshCw className="h-4 w-4" /> Retry
      </Button>
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, format, indicator, indicatorValue, color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  format?: 'number' | 'percent';
  indicator?: 'up' | 'down';
  indicatorValue?: string;
  color?: string;
}) {
  const isUp = indicator === 'up';
  const displayValue = format === 'percent' ? `${value}%` : value.toLocaleString('en-IN');
  const c = color || NAVY;

  return (
    <Card className="gap-3 py-4 hover:shadow-md transition-shadow">
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${c}12` }}>
            <Icon className="h-5 w-5" style={{ color: c }} />
          </div>
          {indicatorValue && (
            <div className={`flex items-center gap-0.5 text-xs font-medium ${isUp ? 'text-green-600' : 'text-red-500'}`}>
              {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {indicatorValue}
            </div>
          )}
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold tracking-tight">{displayValue}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Role-Specific Welcome Banner ────────────────────────────────────────────

function WelcomeBanner() {
  const { currentUser } = useAppStore();
  if (!currentUser) return null;
  const role = currentUser.role;
  const roleColor = ROLE_COLORS[role];

  const roleDescriptions: Record<Role, string> = {
    super_admin: 'You have full system control. Monitor all campus operations from here.',
    admin: 'Manage campus-wide attendance, courses, and user accounts.',
    hod: 'Overview of your department — attendance, faculty, and course performance.',
    faculty: 'Track your course sessions, student attendance, and assignments.',
    lab_assistant: 'Monitor lab sessions and equipment geofences in real time.',
    student: 'View your attendance, upcoming classes, assignments, and grades.',
    parent: 'Monitor your child\'s attendance and academic performance.',
    visitor: 'Explore the campus — view geofences and campus information.',
    security: 'Monitor live sessions, violations, and campus security alerts.',
  };

  return (
    <Card className="border-l-4 overflow-hidden" style={{ borderLeftColor: roleColor }}>
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg md:text-xl font-bold" style={{ color: roleColor }}>
              {getGreeting()}, {currentUser.name.split(' ')[0]}!
            </h2>
            <p className="text-sm text-muted-foreground mt-1">{roleDescriptions[role]}</p>
            {currentUser.department && (
              <Badge variant="secondary" className="mt-2 text-[10px] gap-1">
                <Building2 className="h-3 w-3" /> {currentUser.department}
              </Badge>
            )}
          </div>
          <Badge className="text-white shrink-0" style={{ backgroundColor: roleColor }}>
            {ROLE_LABELS[role]}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Active Sessions Card ────────────────────────────────────────────────────

function ActiveSessionsCard({ sessions }: { sessions: ActiveSession[] }) {
  if (sessions.length === 0) {
    return (
      <Card className="border-l-4 border-l-green-500">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
            </div>
            <CardTitle className="text-base">Active Sessions</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No active sessions right now</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-l-4 border-l-green-500">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
            </div>
            <CardTitle className="text-base">Active Sessions</CardTitle>
            <Badge variant="secondary" className="text-[10px]">{sessions.length} live</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-64">
          <div className="space-y-3">
            {sessions.map((session) => {
              const pct = session.expectedCount > 0 ? Math.round((session.presentCount / session.expectedCount) * 100) : 0;
              const MethodIcon = getMethodIcon(session.captureMethod);
              return (
                <div key={session.id} className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="text-[10px] font-semibold" style={{ backgroundColor: NAVY, color: '#fff' }}>
                        {session.course?.code || 'N/A'}
                      </Badge>
                      <span className="text-sm font-medium">{session.course?.name || 'Unknown Course'}</span>
                      {session.timetableSlotId ? (
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-0">On schedule</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">Ad-hoc</Badge>
                      )}
                    </div>
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <MethodIcon className="h-3 w-3" />
                      {captureMethodConfig[session.captureMethod]?.label || session.captureMethod}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{session.startTime}</span>
                    {session.timetableSlot && (
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{session.timetableSlot.roomNumber}</span>
                    )}
                    {session.geofence && (
                      <span className="flex items-center gap-1"><Radio className="h-3 w-3" />{session.geofence.name}</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Attendance</span>
                      <span className="font-medium">{session.presentCount}/{session.expectedCount} ({pct}%)</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Started by {session.creator?.name || 'Unknown'}</p>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ─── Charts ──────────────────────────────────────────────────────────────────

function ChartBox({ height, children }: { height: number; children: React.ReactNode }) {
  return (
    <div className="relative isolate w-full overflow-hidden" style={{ height, minHeight: height }}>
      {children}
    </div>
  );
}

const chartContainerClass = 'aspect-auto h-64 w-full min-h-64 shrink-0 overflow-hidden';

function CourseAttendanceChart({ data }: { data: CourseAttendance[] }) {
  const chartData = data.map((c) => ({ code: c.code, percentage: c.percentage, name: c.name }));
  return (
    <Card className="overflow-hidden min-w-0">
      <CardHeader className="pb-2"><CardTitle className="text-base">Course-wise Attendance</CardTitle></CardHeader>
      <CardContent className="space-y-4 overflow-hidden">
        <ChartBox height={256}>
          <ChartContainer config={courseChartConfig} className={chartContainerClass}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="code" tickLine={false} axisLine={false} fontSize={11} className="fill-muted-foreground" />
              <YAxis tickLine={false} axisLine={false} fontSize={11} domain={[0, 100]} className="fill-muted-foreground" />
              <ChartTooltip content={<ChartTooltipContent formatter={(value, _name, item) => (
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{(item as { payload?: { name?: string } }).payload?.name}</span>
                  <span>{Number(value)}% attendance</span>
                </div>
              )} />} />
              <Bar dataKey="percentage" fill={NAVY} radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ChartContainer>
        </ChartBox>
        {data.length > 0 && (
          <>
            <Separator />
            <ScrollArea className="max-h-48">
              <div className="space-y-3 pr-3">
                {data.map((course) => (
                  <div key={course.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="secondary" className="text-[10px] font-mono shrink-0">{course.code}</Badge>
                        <span className="font-medium text-xs truncate" title={course.name}>{course.name}</span>
                      </div>
                      <span className={cn(
                        'text-xs font-semibold shrink-0',
                        course.percentage >= 75 ? 'text-green-600' : course.percentage >= 50 ? 'text-amber-600' : 'text-red-600'
                      )}>{course.percentage}%</span>
                    </div>
                    <Progress value={course.percentage} className="h-2" />
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CaptureMethodsChart({ data }: { data: Record<string, number> }) {
  const chartData = Object.entries(data).map(([method, count]) => ({
    method, count, fill: captureMethodConfig[method]?.color || '#94A3B8',
  }));
  const total = chartData.reduce((s, d) => s + d.count, 0);

  return (
    <Card className="overflow-hidden min-w-0">
      <CardHeader className="pb-2"><CardTitle className="text-base">Capture Method Distribution</CardTitle></CardHeader>
      <CardContent className="overflow-hidden">
        <ChartBox height={256}>
          <ChartContainer config={captureChartConfig} className={chartContainerClass}>
          <PieChart>
            <Pie data={chartData} dataKey="count" nameKey="method" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} strokeWidth={2} stroke="var(--background)">
              {chartData.map((entry) => (<Cell key={entry.method} fill={entry.fill} />))}
            </Pie>
            <RechartsTooltip content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0];
              const method = item.payload?.method || item.name || '';
              const count = Number(item.value) || 0;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div className="border-border/50 bg-background rounded-lg border px-3 py-2 text-xs shadow-xl">
                  <p className="font-medium">{captureMethodConfig[method]?.label || method}</p>
                  <p className="text-muted-foreground">{count} sessions ({pct}%)</p>
                </div>
              );
            }} />
            <ChartLegend content={<ChartLegendContent nameKey="method" className="flex-wrap gap-x-4 gap-y-1 text-[11px]" />} />
          </PieChart>
        </ChartContainer>
        </ChartBox>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 px-4">
          {chartData.map((entry) => {
            const Icon = captureMethodConfig[entry.method]?.icon || Hand;
            const pct = total > 0 ? Math.round((entry.count / total) * 100) : 0;
            return (
              <div key={entry.method} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <div className="h-2 w-2 rounded-sm" style={{ backgroundColor: entry.fill }} />
                <Icon className="h-3 w-3" />
                <span>{pct}%</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function WeeklyRateTrendChart({ data }: { data: { week: string; rate: number }[] }) {
  if (!data.length) return null;
  return (
    <Card className="overflow-hidden min-w-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" style={{ color: NAVY }} />
          Attendance rate trend
        </CardTitle>
        <CardDescription>Weekly present % in your scope</CardDescription>
      </CardHeader>
      <CardContent className="overflow-hidden">
        <ChartBox height={220}>
          <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" fontSize={10} tickFormatter={(v) => v.slice(5)} />
            <YAxis domain={[0, 100]} fontSize={11} />
            <RechartsTooltip formatter={(v: number) => [`${v}%`, 'Rate']} />
            <Line type="monotone" dataKey="rate" stroke={NAVY} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
        </ChartBox>
      </CardContent>
    </Card>
  );
}

function AnalyticsInsightsPanel({ data }: { data: DashboardData }) {
  const analytics = data.analytics;
  if (!analytics) return null;

  const rateData = analytics.weeklyRateTrend ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Depth analytics</h2>
        {data.scopeLabel && (
          <Badge className="text-white" style={{ backgroundColor: NAVY }}>{data.scopeLabel}</Badge>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {[
          { label: 'At risk (<75%)', value: analytics.atRiskCount, icon: AlertTriangle, color: '#E74C3C' },
          { label: 'Avg grade', value: `${analytics.avgGradePct}%`, icon: Award, color: NAVY },
          { label: 'Quiz attempts', value: analytics.quizAttempts, icon: ClipboardCheck, color: '#7C3AED' },
          { label: 'Avg quiz score', value: `${analytics.avgQuizScore}%`, icon: Target, color: '#1B6B4A' },
          { label: 'Submissions', value: analytics.submissions, icon: FileText, color: '#B45309' },
        ].map((k) => (
          <Card key={k.label} className="py-3">
            <CardContent className="flex items-center gap-3 px-3">
              <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${k.color}12` }}>
                <k.icon className="h-4 w-4" style={{ color: k.color }} />
              </div>
              <div>
                <p className="text-lg font-bold">{k.value}</p>
                <p className="text-[10px] text-muted-foreground">{k.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="min-w-0">
          <WeeklyRateTrendChart data={rateData} />
        </div>

        <div className="min-w-0">
        {data.analyticsScope === 'campus' && analytics.departmentAnalytics.length > 0 ? (
          <Card className="overflow-hidden min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Department attendance</CardTitle>
              <CardDescription>Average % by department</CardDescription>
            </CardHeader>
            <CardContent className="overflow-hidden">
              <ChartBox height={220}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.departmentAnalytics.slice(0, 6)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="department" fontSize={9} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis domain={[0, 100]} fontSize={11} />
                    <RechartsTooltip />
                    <Bar dataKey="avgAttendance" fill="#1B6B4A" name="Avg %" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartBox>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top performers</CardTitle>
              <CardDescription>Highest attendance in your scope</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {analytics.topPerformers.slice(0, 5).map((s, i) => (
                <div key={s.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                  <span className="font-medium truncate">{i + 1}. {s.name}</span>
                  <Badge variant="secondary">{s.stats.percentage}%</Badge>
                </div>
              ))}
              {analytics.topPerformers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No attendance data yet</p>
              )}
            </CardContent>
          </Card>
        )}
        </div>
      </div>

      {analytics.atRiskStudents.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-4 w-4" /> Students below 75% ({analytics.atRiskCount})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-48">
              <div className="divide-y">
                {analytics.atRiskStudents.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.department ?? '—'}</p>
                    </div>
                    <Badge variant="outline" className="text-red-600 border-red-200 shrink-0">{s.stats.percentage}%</Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function WeeklyTrendChart({ data }: { data: WeeklyTrend[] }) {
  const chartData = data.map((d) => ({ ...d, date: formatDate(d.date) }));
  return (
    <Card className="overflow-hidden min-w-0">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Weekly Attendance Trend</CardTitle>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#2ECC71]" />Present</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#E74C3C]" />Absent</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#F39C12]" />Late</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-hidden">
        <ChartBox height={224}>
          <ChartContainer config={weeklyChartConfig} className="aspect-auto h-56 w-full min-h-56 shrink-0 overflow-hidden">
          <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -4 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} className="fill-muted-foreground" />
            <YAxis tickLine={false} axisLine={false} fontSize={11} className="fill-muted-foreground" />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="present" stackId="a" fill="#2ECC71" radius={[0, 0, 0, 0]} maxBarSize={36} />
            <Bar dataKey="late" stackId="a" fill="#F39C12" radius={[0, 0, 0, 0]} maxBarSize={36} />
            <Bar dataKey="absent" stackId="a" fill="#E74C3C" radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ChartContainer>
        </ChartBox>
      </CardContent>
    </Card>
  );
}

function ViolationsChart({ byType, bySeverity }: { byType: Record<string, number>; bySeverity: Record<string, number> }) {
  const typeLabels: Record<string, string> = { spoofing: 'Spoofing', proxy: 'Proxy Attendance', face_mismatch: 'Face Mismatch', location_spoof: 'Location Spoof', multiple_device: 'Multi-Device', out_of_geofence: 'Out of Geofence' };
  const chartData = Object.entries(byType).map(([type, count]) => ({ type: typeLabels[type] || type, count }));
  const severityData = Object.entries(bySeverity).map(([sev, count]) => ({ severity: sev.charAt(0).toUpperCase() + sev.slice(1), count }));

  return (
    <Card className="overflow-hidden min-w-0">
      <CardHeader className="pb-2"><CardTitle className="text-base">Violations Overview</CardTitle></CardHeader>
      <CardContent className="space-y-4 overflow-hidden">
        <ChartBox height={144}>
          <ChartContainer config={violationChartConfig} className="aspect-auto h-36 w-full min-h-36 shrink-0 overflow-hidden">
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} className="fill-muted-foreground" />
            <YAxis type="category" dataKey="type" tickLine={false} axisLine={false} fontSize={10} width={90} className="fill-muted-foreground" />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="#E74C3C" radius={[0, 4, 4, 0]} maxBarSize={20} />
          </BarChart>
        </ChartContainer>
        </ChartBox>
        <Separator />
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Severity Breakdown</p>
          {severityData.map((item) => (
            <div key={item.severity} className="flex items-center justify-between text-xs">
              <Badge variant="outline" className={getSeverityColor(item.severity.toLowerCase())}>{item.severity}</Badge>
              <span className="font-medium">{item.count}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RecentActivityFeed({ activities }: { activities: RecentActivity[] }) {
  if (activities.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Recent Activity</CardTitle>
          <Badge variant="secondary" className="text-[10px]">{activities.length} records</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-96">
          <div className="space-y-1">
            {activities.map((activity, idx) => {
              const MethodIcon = getMethodIcon(activity.captureMethod);
              return (
                <div key={activity.id} className="relative flex gap-3 pb-3">
                  {idx < activities.length - 1 && (<div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />)}
                  <div className="mt-1 h-[30px] w-[30px] shrink-0 rounded-full border bg-background flex items-center justify-center z-10">
                    <MethodIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{activity.student.name}</span>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${getStatusColor(activity.status)}`}>{activity.status}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{activity.session.course.code}</span>
                      <span>&middot;</span>
                      <span>{activity.student.department}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatDate(activity.session.sessionDate)} {activity.markedAt ? formatTime(activity.markedAt) : ''}</span>
                      <span>&middot;</span>
                      <span>{captureMethodConfig[activity.captureMethod]?.label || activity.captureMethod}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ─── ROLE-SPECIFIC DASHBOARD SECTIONS ────────────────────────────────────────

// ─── Super Admin Knuct Operations Center ────────────────────────────────────

function KnuctOpsPanel({ knuct }: { knuct?: KnuctDashboardStats }) {
  const { setActiveSection } = useAppStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pilotStatus } = useQuery({
    queryKey: ['knuct-pilot-status'],
    queryFn: async () => {
      const res = await fetch('/api/knuct/pilot');
      if (!res.ok) throw new Error('Failed to load pilot status');
      return res.json() as Promise<{
        pilotReady: boolean;
        health: { adapterMode: 'mock' | 'live'; health: 'ok' | 'degraded' | 'down' | 'unknown'; circuitBreakerOpen: boolean };
      }>;
    },
  });

  const adapterMode = pilotStatus?.health?.adapterMode ?? knuct?.adapterMode ?? 'mock';
  const health = pilotStatus?.health?.health ?? knuct?.health ?? 'unknown';
  const circuitBreakerOpen = pilotStatus?.health?.circuitBreakerOpen ?? knuct?.circuitBreakerOpen ?? false;

  const pilotMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/knuct/pilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sync: true, limit: 5 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Pilot failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      queryClient.invalidateQueries({ queryKey: ['knuct-status'] });
      queryClient.invalidateQueries({ queryKey: ['knuct-pilot-status'] });
      const active = data.results?.filter((r: { status: string }) => r.status === 'active').length ?? 0;
      const failed = data.results?.filter((r: { status: string }) => r.status === 'failed').length ?? 0;
      toast({
        title: 'Live pilot run complete',
        description: `${active} active, ${failed} failed — see Users for details`,
        variant: failed > 0 ? 'destructive' : 'default',
      });
    },
    onError: (err: Error) => {
      toast({ title: 'Pilot failed', description: err.message, variant: 'destructive' });
    },
  });
  const healthBadge = {
    ok: { label: 'Healthy', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    degraded: { label: 'Degraded', className: 'bg-amber-100 text-amber-800 border-amber-200' },
    down: { label: 'Down', className: 'bg-red-100 text-red-800 border-red-200' },
    unknown: { label: 'Not checked', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  }[health] ?? { label: 'Unknown', className: 'bg-muted text-muted-foreground border-border' };

  return (
    <Card className="border-[#1A3C6E]/20 bg-gradient-to-br from-[#1A3C6E]/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2" style={{ color: NAVY }}>
            <Link2 className="h-4 w-4" /> Knuct Operations Center
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={healthBadge.className}>{healthBadge.label}</Badge>
            <Badge variant="outline">{adapterMode === 'live' ? 'Live adapter' : 'Mock adapter'}</Badge>
            {circuitBreakerOpen && (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Circuit open</Badge>
            )}
          </div>
        </div>
        <CardDescription>
          Blockchain identity pilot — wallet provisioning and campus DID coverage (super_admin)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: 'Active wallets', value: knuct?.wallets.active ?? '—', icon: Wallet, color: NAVY },
            { label: 'Anchors today', value: knuct?.anchors.today ?? '—', icon: ShieldCheck, color: '#1B6B4A' },
            { label: 'Failed wallets', value: knuct?.wallets.failed ?? '—', icon: XCircle, color: '#E74C3C' },
            { label: 'DID coverage', value: knuct ? `${knuct.didCoveragePct}%` : '—', icon: Users, color: '#7C3AED' },
            { label: 'Pending wallets', value: knuct?.wallets.pending ?? '—', icon: Timer, color: '#B45309' },
            { label: 'Adapter', value: adapterMode, icon: Radio, color: '#0E7490' },
          ].map((k) => (
            <div key={k.label} className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-2 mb-1">
                <k.icon className="h-3.5 w-3.5" style={{ color: k.color }} />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{k.label}</span>
              </div>
              <p className="text-lg font-bold">{k.value}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            style={{ backgroundColor: NAVY }}
            disabled={adapterMode !== 'live' || pilotMutation.isPending}
            title={adapterMode !== 'live' ? 'Requires live Knuct adapter (set KNUCT_ENABLED=true)' : undefined}
            onClick={() => pilotMutation.mutate()}
          >
            {pilotMutation.isPending ? 'Provisioning…' : 'Run live pilot (5 users)'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setActiveSection('settings')}>
            Settings
          </Button>
          <Button variant="outline" size="sm" onClick={() => setActiveSection('users')}>
            Users (retry failed)
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Hash anchors stored in PostgreSQL; enable <code className="text-xs">KNUCT_CHAIN_PUBLISH_URL</code> when the vendor publish API is available.
        </p>
        {(knuct?.recentActivity.length ?? 0) > 0 && (
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-xs font-medium">Recent anchors</p>
            {knuct!.recentActivity.slice(0, 5).map((a, i) => (
              <div key={i} className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                <span>{a.module}</span>
                <span>{a.ref}…</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Admin / Super Admin Dashboard (Full View) ──────────────────────────────

function AdminDashboard({ data, role }: { data: DashboardData; role: Role }) {
  const { stats, courseAttendance, captureMethods, weeklyTrend, recentActivity, activeSessionsList, violationByType, violationBySeverity } = data;

  return (
    <div className="space-y-6">
      {role === 'super_admin' && <KnuctOpsPanel knuct={data.knuct} />}
      <AnalyticsInsightsPanel data={data} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Students" value={stats.totalStudents} icon={Users} format="number" />
        <StatCard label="Total Faculty" value={stats.totalFaculty} icon={GraduationCap} format="number" />
        <StatCard label="Total Courses" value={stats.totalCourses} icon={BookOpen} format="number" />
        <StatCard label="Active Sessions" value={stats.activeSessions} icon={ScanLine} format="number" />
        <StatCard label="Attendance Rate" value={stats.overallAttendance} icon={Activity} format="percent" />
        <StatCard label="Pending Violations" value={stats.pendingViolations} icon={ShieldAlert} format="number" color="#E74C3C" />
        <StatCard label="Total Enrollments" value={stats.totalEnrollments} icon={UserPlus} format="number" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="min-w-0"><ActiveSessionsCard sessions={activeSessionsList} /></div>
        <div className="min-w-0"><ViolationsChart byType={violationByType} bySeverity={violationBySeverity} /></div>
        <div className="min-w-0">
        <Card className="overflow-hidden">
          <CardHeader className="pb-2"><CardTitle className="text-base">Attendance Breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {[
                { label: 'Present', value: stats.totalPresent, color: 'bg-green-500', barColor: '' },
                { label: 'Absent', value: stats.totalAbsent, color: 'bg-red-500', barColor: '[&>[data-slot=progress-indicator]]:bg-red-500' },
                { label: 'Late', value: stats.totalLate, color: 'bg-amber-500', barColor: '[&>[data-slot=progress-indicator]]:bg-amber-500' },
              ].map(item => (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />{item.label}</span>
                    <span className="font-semibold">{item.value}</span>
                  </div>
                  <Progress value={stats.totalPresent + stats.totalAbsent + stats.totalLate > 0 ? (item.value / (stats.totalPresent + stats.totalAbsent + stats.totalLate)) * 100 : 0} className={`h-2 ${item.barColor}`} />
                </div>
              ))}
            </div>
            <Separator />
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="space-y-1"><p className="text-lg font-bold" style={{ color: NAVY }}>{stats.totalSessions}</p><p className="text-[10px] text-muted-foreground">Total Sessions</p></div>
              <div className="space-y-1"><p className="text-lg font-bold text-green-600">{stats.activeSessions}</p><p className="text-[10px] text-muted-foreground">Active Now</p></div>
              <div className="space-y-1"><p className="text-lg font-bold text-amber-600">{stats.overallAttendance}%</p><p className="text-[10px] text-muted-foreground">Overall Rate</p></div>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="min-w-0"><CourseAttendanceChart data={courseAttendance} /></div>
        <div className="min-w-0"><CaptureMethodsChart data={captureMethods} /></div>
      </div>
      <WeeklyTrendChart data={weeklyTrend} />
      <RecentActivityFeed activities={recentActivity} />
    </div>
  );
}

// ─── HOD Dashboard ───────────────────────────────────────────────────────────

function HODDashboard({ data }: { data: DashboardData }) {
  const { stats, courseAttendance, weeklyTrend, activeSessionsList, violationByType, violationBySeverity } = data;

  return (
    <div className="space-y-6">
      <AnalyticsInsightsPanel data={data} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Department Students" value={stats.totalStudents} icon={Users} format="number" indicator="up" indicatorValue="8%" color="#1B6B4A" />
        <StatCard label="Department Faculty" value={stats.totalFaculty} icon={GraduationCap} format="number" />
        <StatCard label="Dept. Attendance" value={stats.overallAttendance} icon={Activity} format="percent" color="#1B6B4A" />
        <StatCard label="Pending Violations" value={stats.pendingViolations} icon={ShieldAlert} format="number" color="#E74C3C" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="min-w-0"><ActiveSessionsCard sessions={activeSessionsList} /></div>
        <div className="min-w-0"><ViolationsChart byType={violationByType} bySeverity={violationBySeverity} /></div>
      </div>

      <div className="min-w-0"><CourseAttendanceChart data={courseAttendance} /></div>
      <WeeklyTrendChart data={weeklyTrend} />
      <RecentActivityFeed activities={data.recentActivity} />
    </div>
  );
}

// ─── Faculty Dashboard ───────────────────────────────────────────────────────

function FacultyDashboard({ data }: { data: DashboardData }) {
  const { stats, courseAttendance, weeklyTrend, activeSessionsList } = data;

  return (
    <div className="space-y-6">
      <AnalyticsInsightsPanel data={data} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="My Courses" value={stats.totalCourses} icon={BookOpen} format="number" color="#7C3AED" />
        <StatCard label="Active Sessions" value={stats.activeSessions} icon={ScanLine} format="number" color="#7C3AED" />
        <StatCard label="My Students" value={stats.totalStudents} icon={Users} format="number" color="#7C3AED" />
        <StatCard label="Avg. Attendance" value={stats.overallAttendance} icon={Activity} format="percent" color="#7C3AED" />
      </div>

      <ActiveSessionsCard sessions={activeSessionsList} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="min-w-0"><CourseAttendanceChart data={courseAttendance} /></div>
        <div className="min-w-0">
        <Card className="overflow-hidden">
          <CardHeader className="pb-2"><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {[
              { icon: ScanLine, label: 'Start Attendance', desc: 'Create a new session', color: '#7C3AED' },
              { icon: FileText, label: 'Create Assignment', desc: 'For your courses', color: '#0E7490' },
              { icon: ClipboardCheck, label: 'Grade Submissions', desc: '3 pending', color: '#B45309' },
              { icon: BookMarked, label: 'Create Quiz', desc: 'Assess students', color: '#1B6B4A' },
            ].map(action => (
              <button key={action.label} className="rounded-lg border p-3 text-left hover:bg-accent transition-colors gap-2 flex flex-col">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${action.color}12` }}>
                  <action.icon className="h-4 w-4" style={{ color: action.color }} />
                </div>
                <span className="text-sm font-medium">{action.label}</span>
                <span className="text-[10px] text-muted-foreground">{action.desc}</span>
              </button>
            ))}
          </CardContent>
        </Card>
        </div>
      </div>

      <WeeklyTrendChart data={weeklyTrend} />
      <RecentActivityFeed activities={data.recentActivity} />
    </div>
  );
}

// ─── Lab Assistant Dashboard ─────────────────────────────────────────────────

function LabAssistantDashboard({ data }: { data: DashboardData }) {
  const { stats, activeSessionsList, captureMethods } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Lab Sessions" value={stats.totalSessions} icon={ScanLine} format="number" color="#B45309" />
        <StatCard label="Active Now" value={stats.activeSessions} icon={Activity} format="number" color="#B45309" />
        <StatCard label="Equipment Zones" value={Object.keys(captureMethods).length} icon={MapPin} format="number" color="#B45309" />
        <StatCard label="Lab Attendance" value={stats.overallAttendance} icon={ClipboardCheck} format="percent" color="#B45309" />
      </div>

      <ActiveSessionsCard sessions={activeSessionsList} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CaptureMethodsChart data={captureMethods} />
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Equipment & Zones</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { zone: 'CS Lab 1', status: 'online', devices: 24, icon: Wifi },
              { zone: 'CS Lab 2', status: 'online', devices: 18, icon: Wifi },
              { zone: 'Electronics Lab', status: 'maintenance', devices: 12, icon: AlertTriangle },
              { zone: 'Server Room', status: 'online', devices: 8, icon: ShieldCheck },
            ].map(zone => (
              <div key={zone.zone} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${zone.status === 'online' ? 'bg-green-500/10' : 'bg-amber-500/10'}`}>
                    <zone.icon className={`h-4 w-4 ${zone.status === 'online' ? 'text-green-600' : 'text-amber-600'}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{zone.zone}</p>
                    <p className="text-[10px] text-muted-foreground">{zone.devices} devices</p>
                  </div>
                </div>
                <Badge variant="outline" className={zone.status === 'online' ? 'text-green-600 border-green-200' : 'text-amber-600 border-amber-200'}>
                  {zone.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Student Dashboard ───────────────────────────────────────────────────────

function StudentDashboard({ data }: { data: DashboardData }) {
  const { stats, courseAttendance, weeklyTrend, riskStatus, weeklyRateTrend } = data;
  const attendanceColor = stats.overallAttendance >= 75 ? '#0E7490' : stats.overallAttendance >= 50 ? '#B45309' : '#E74C3C';
  const riskBadge = {
    on_track: { label: 'On track', className: 'bg-emerald-100 text-emerald-800' },
    watch: { label: 'Watch list', className: 'bg-amber-100 text-amber-800' },
    at_risk: { label: 'At risk (<75%)', className: 'bg-red-100 text-red-800' },
    no_data: { label: 'No attendance yet', className: 'bg-muted text-muted-foreground' },
  }[riskStatus ?? 'no_data'] ?? { label: 'Unknown', className: 'bg-muted text-muted-foreground' };
  const rateTrend = weeklyRateTrend ?? weeklyTrend.map((w) => ({ week: w.date, rate: w.rate ?? 0 }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className={riskBadge.className}>{riskBadge.label}</Badge>
        <Badge variant="outline" className="gap-1"><BarChart2 className="h-3 w-3" /> Personal analytics</Badge>
      </div>
      {/* Attendance Ring + Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="sm:col-span-2 lg:col-span-1">
          <CardContent className="flex flex-col items-center justify-center py-6">
            <div className="relative h-32 w-32">
              <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/20" />
                <circle cx="60" cy="60" r="52" fill="none" stroke={attendanceColor} strokeWidth="10"
                  strokeDasharray={`${(stats.overallAttendance / 100) * 327} 327`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold" style={{ color: attendanceColor }}>{stats.overallAttendance}%</span>
                <span className="text-[10px] text-muted-foreground">Attendance</span>
              </div>
            </div>
            <p className="text-sm font-medium mt-2">
              {stats.overallAttendance >= 75 ? (
                <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> Eligible for exams</span>
              ) : (
                <span className="text-red-600 flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Below 75% requirement</span>
              )}
            </p>
          </CardContent>
        </Card>
        <StatCard label="My Courses" value={stats.totalCourses} icon={BookOpen} format="number" color="#0E7490" />
        <StatCard label="Classes Attended" value={stats.totalPresent} icon={CheckCircle2} format="number" color="#0E7490" />
        <StatCard label="Classes Missed" value={stats.totalAbsent + stats.totalLate} icon={XCircle} format="number" color="#E74C3C" />
      </div>

      {/* Course Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">My Course Attendance</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {courseAttendance.slice(0, 6).map(course => (
              <div key={course.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] font-mono">{course.code}</Badge>
                    <span className="font-medium text-xs truncate max-w-[140px]">{course.name}</span>
                  </div>
                  <span className={`text-xs font-semibold ${course.percentage >= 75 ? 'text-green-600' : course.percentage >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                    {course.percentage}%
                  </span>
                </div>
                <Progress value={course.percentage} className={`h-2 ${course.percentage >= 75 ? '' : course.percentage >= 50 ? '[&>[data-slot=progress-indicator]]:bg-amber-500' : '[&>[data-slot=progress-indicator]]:bg-red-500'}`} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Upcoming / Quick Actions */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Upcoming & Actions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { icon: Calendar, label: 'Next Class', value: 'CS501 — 10:00 AM Today', color: '#0E7490' },
              { icon: FileText, label: 'Assignment Due', value: 'Algorithm Design — 2 days left', color: '#B45309' },
              { icon: ClipboardCheck, label: 'Quiz Scheduled', value: 'CS503 Quiz — Tomorrow', color: '#7C3AED' },
              { icon: Award, label: 'Latest Grade', value: 'CS502: A+ (92/100)', color: '#1B6B4A' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${item.color}12` }}>
                  <item.icon className="h-4 w-4" style={{ color: item.color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium">{item.label}</p>
                  <p className="text-sm text-muted-foreground truncate">{item.value}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {rateTrend.length > 0 && (
        <WeeklyRateTrendChart data={rateTrend.map((w) => ({ week: w.week, rate: w.rate }))} />
      )}

      <WeeklyTrendChart data={weeklyTrend} />
    </div>
  );
}

// ─── Parent Dashboard ────────────────────────────────────────────────────────

function ParentDashboard({ data }: { data: DashboardData }) {
  const { stats, courseAttendance, weeklyTrend, ward } = data;
  const wardName = ward?.name ?? 'Your ward';
  const wardDept = ward?.department ?? '—';
  const initials = wardName.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      <Card className="border-l-4" style={{ borderLeftColor: '#BE185D' }}>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full flex items-center justify-center text-white text-lg font-bold" style={{ backgroundColor: '#BE185D' }}>
              {initials}
            </div>
            <div>
              <h3 className="text-lg font-semibold">{wardName}</h3>
              <p className="text-sm text-muted-foreground">{wardDept}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={`text-[10px] ${stats.overallAttendance >= 75 ? 'text-green-600 border-green-200' : 'text-red-600 border-red-200'}`}>
                  {stats.overallAttendance >= 75 ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                  {stats.overallAttendance}% Attendance
                </Badge>
                <Badge variant="outline" className="text-[10px]"><Award className="h-3 w-3 mr-1" />Good Standing</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Overall Attendance" value={stats.overallAttendance} icon={Activity} format="percent" color="#BE185D" />
        <StatCard label="Classes Attended" value={stats.totalPresent} icon={CheckCircle2} format="number" color="#BE185D" />
        <StatCard label="Classes Missed" value={stats.totalAbsent} icon={XCircle} format="number" color="#E74C3C" />
        <StatCard label="Late Arrivals" value={stats.totalLate} icon={Timer} format="number" color="#B45309" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Course-wise Performance</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {courseAttendance.slice(0, 6).map(course => (
              <div key={course.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] font-mono">{course.code}</Badge>
                    <span className="font-medium text-xs truncate max-w-[140px]">{course.name}</span>
                  </div>
                  <span className={`text-xs font-semibold ${course.percentage >= 75 ? 'text-green-600' : 'text-red-600'}`}>
                    {course.percentage}%
                  </span>
                </div>
                <Progress value={course.percentage} className={`h-2 ${course.percentage >= 75 ? '' : '[&>[data-slot=progress-indicator]]:bg-red-500'}`} />
              </div>
            ))}
          </CardContent>
        </Card>
        <WeeklyTrendChart data={weeklyTrend} />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Recent Notifications</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {[
            { icon: AlertTriangle, text: 'Arun was marked absent in CS502 on Monday', time: '2 hours ago', color: '#E74C3C' },
            { icon: CheckCircle2, text: 'Arun achieved 92% in CS502 assignment', time: '1 day ago', color: '#1B6B4A' },
            { icon: Bell, text: 'Parent-Teacher meeting scheduled for Friday', time: '2 days ago', color: '#7C3AED' },
            { icon: Activity, text: 'Monthly attendance report available', time: '3 days ago', color: '#0E7490' },
          ].map((n, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${n.color}12` }}>
                <n.icon className="h-4 w-4" style={{ color: n.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">{n.text}</p>
                <p className="text-[10px] text-muted-foreground">{n.time}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Visitor Dashboard ───────────────────────────────────────────────────────

function VisitorDashboard({ data }: { data: DashboardData }) {
  const { stats } = data;
  const { data: geofenceData } = useQuery({
    queryKey: ['visitor-geofences'],
    queryFn: async () => {
      const res = await fetch('/api/geofences');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load geofences');
      return json as { geofences: GeofenceItem[] };
    },
    staleTime: 60_000,
  });
  const campusZones = (geofenceData?.geofences ?? []).filter((g) => g.isActive).slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Campus Info Banner */}
      <Card className="border-l-4" style={{ borderLeftColor: '#6B7280' }}>
        <CardContent className="p-4 md:p-5">
          <div className="flex items-start gap-4">
            <BrandLogo size="md" className="shrink-0" />
            <div>
              <h3 className="text-lg font-semibold text-[#1A3C6E]">AIMSCS</h3>
              <p className="text-sm text-muted-foreground">Welcome to the AIMSCS Smart Campus. Explore campus zones and information below.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Campus Students" value={stats.totalStudents} icon={Users} format="number" color="#6B7280" />
        <StatCard label="Faculty Members" value={stats.totalFaculty} icon={GraduationCap} format="number" color="#6B7280" />
        <StatCard label="Active Courses" value={stats.totalCourses} icon={BookOpen} format="number" color="#6B7280" />
        <StatCard label="Campus Zones" value={campusZones.length || 4} icon={MapPin} format="number" color="#6B7280" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Campus Zones */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Campus Zones & Geofences</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {campusZones.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Loading campus zones…</p>
            ) : (
              campusZones.map((zone) => (
                <div key={zone.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-[#1A3C6E]/10 flex items-center justify-center">
                      <MapPin className="h-4 w-4 text-[#1A3C6E]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{zone.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {zone.type === 'polygon'
                          ? `Polygon${zone.building ? ` • ${zone.building}` : ''}`
                          : `${zone.building || 'Campus'} • ${zone.radiusMtrs ?? '—'}m radius`}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-green-600 border-green-200">active</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Visitor Guidelines */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Visitor Guidelines</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { icon: ShieldCheck, text: 'Register at the main gate with valid ID', color: '#1B6B4A' },
              { icon: MapPin, text: 'Stay within designated visitor zones', color: '#1A3C6E' },
              { icon: Clock, text: 'Visiting hours: 9:00 AM – 5:00 PM', color: '#B45309' },
              { icon: Eye, text: 'CCTV monitoring is active on campus', color: '#6B7280' },
              { icon: Wifi, text: 'Guest WiFi: AIMSCS-Guest (no password)', color: '#7C3AED' },
              { icon: AlertTriangle, text: 'Report suspicious activity to Security', color: '#E74C3C' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${item.color}12` }}>
                  <item.icon className="h-4 w-4" style={{ color: item.color }} />
                </div>
                <p className="text-sm">{item.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Security Dashboard ──────────────────────────────────────────────────────

function SecurityDashboard({ data }: { data: DashboardData }) {
  const { stats, activeSessionsList, violationByType, violationBySeverity, recentActivity } = data;

  return (
    <div className="space-y-6">
      <AnalyticsInsightsPanel data={data} />
      {/* Alert Banner */}
      {stats.pendingViolations > 0 && (
        <Card className="border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center animate-pulse">
              <ShieldAlert className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="font-semibold text-red-700 dark:text-red-400">{stats.pendingViolations} Pending Violations Require Review</p>
              <p className="text-sm text-red-600/70 dark:text-red-400/70">Immediate attention needed for campus security compliance</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Sessions" value={stats.activeSessions} icon={ScanLine} format="number" color="#991B1B" />
        <StatCard label="Pending Violations" value={stats.pendingViolations} icon={ShieldAlert} format="number" color="#E74C3C" />
        <StatCard label="Campus Zones" value={4} icon={MapPin} format="number" color="#991B1B" />
        <StatCard label="Security Alerts" value={Object.values(violationBySeverity).reduce((a, b) => a + b, 0)} icon={Bell} format="number" color="#B45309" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActiveSessionsCard sessions={activeSessionsList} />
        <ViolationsChart byType={violationByType} bySeverity={violationBySeverity} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Security Feed</CardTitle>
            <Badge variant="destructive" className="text-[10px] gap-1"><Radio className="h-3 w-3" /> Live</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-80">
            <div className="space-y-2">
              {recentActivity.slice(0, 15).map((activity) => {
                const isViolation = activity.status === 'absent' || activity.captureMethod === 'face';
                return (
                  <div key={activity.id} className={`flex items-center gap-3 rounded-lg border p-2.5 ${isViolation ? 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/20' : ''}`}>
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${isViolation ? 'bg-amber-500/10' : 'bg-green-500/10'}`}>
                      {isViolation ? <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> : <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{activity.student.name}</span>
                        <Badge variant="outline" className={`text-[9px] ${getStatusColor(activity.status)}`}>{activity.status}</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {activity.session.course.code} • {captureMethodConfig[activity.captureMethod]?.label || activity.captureMethod} • {formatDate(activity.session.sessionDate)}
                      </p>
                    </div>
                    {isViolation && <Badge variant="destructive" className="text-[9px]">Review</Badge>}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Dashboard Section ──────────────────────────────────────────────────

export default function DashboardSection() {
  const { currentUser } = useAppStore();

  const { data, isLoading, isError, refetch } = useQuery<DashboardData>({
    queryKey: ['dashboard', currentUser?.id],
    queryFn: () => fetch('/api/dashboard').then((r) => {
      if (!r.ok) throw new Error('Failed to fetch dashboard data');
      return r.json();
    }),
    enabled: !!currentUser,
    staleTime: 3 * 60 * 1000,
    refetchInterval: 3 * 60 * 1000,
  });

  if (!currentUser) return <DashboardSkeleton />;
  const role = currentUser.role;

  if (isLoading) return <DashboardSkeleton />;
  if (isError || !data) return <DashboardError onRetry={() => refetch()} />;

  const roleDescriptions: Record<Role, string> = {
    super_admin: 'Full System Overview',
    admin: 'Campus Administration',
    hod: 'Department Dashboard',
    faculty: 'Faculty Portal',
    lab_assistant: 'Lab Management',
    student: 'Student Portal',
    parent: 'Ward Monitoring',
    visitor: 'Campus Explorer',
    security: 'Security Command Center',
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: ROLE_COLORS[role] }}>
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            AIMSCS &mdash; {roleDescriptions[role]}
            {data.scopeLabel && (
              <Badge className="ml-2 text-[10px] text-white align-middle" style={{ backgroundColor: ROLE_COLORS[role] }}>
                {data.scopeLabel}
              </Badge>
            )}
          </p>
        </div>
        <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 w-fit">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
        </div>
      </div>

      {/* Role-specific Welcome */}
      <WelcomeBanner />

      <MyKnuctWalletPanel />

      {/* Role-specific content */}
      {(role === 'super_admin' || role === 'admin') && <AdminDashboard data={data} role={role} />}
      {role === 'hod' && <HODDashboard data={data} />}
      {role === 'faculty' && <FacultyDashboard data={data} />}
      {role === 'lab_assistant' && <LabAssistantDashboard data={data} />}
      {role === 'student' && <StudentDashboard data={data} />}
      {role === 'parent' && <ParentDashboard data={data} />}
      {role === 'visitor' && <VisitorDashboard data={data} />}
      {role === 'security' && <SecurityDashboard data={data} />}
    </div>
  );
}
