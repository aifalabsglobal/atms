'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Users, GraduationCap, BookOpen, ScanLine, Activity,
  ShieldAlert, UserPlus, ArrowUpRight, ArrowDownRight,
  Clock, MapPin, Fingerprint, Camera, QrCode, Hand,
  AlertTriangle, Eye, Radio, RefreshCw,
} from 'lucide-react';
import {
  Card, CardHeader, CardTitle, CardContent,
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
  Tooltip as RechartsTooltip,
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
  course: { name: string; code: string };
  creator: { name: string };
  geofence: { name: string } | null;
  timetableSlot: { roomNumber: string; building: string } | null;
}

interface DashboardData {
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

const statCards: {
  key: keyof DashboardStats;
  label: string;
  icon: React.ElementType;
  format?: 'number' | 'percent';
  indicator?: 'up' | 'down';
  indicatorValue?: string;
}[] = [
  { key: 'totalStudents', label: 'Total Students', icon: Users, format: 'number', indicator: 'up', indicatorValue: '12%' },
  { key: 'totalFaculty', label: 'Total Faculty', icon: GraduationCap, format: 'number', indicator: 'up', indicatorValue: '5%' },
  { key: 'totalCourses', label: 'Total Courses', icon: BookOpen, format: 'number', indicator: 'up', indicatorValue: '8%' },
  { key: 'activeSessions', label: 'Active Sessions', icon: ScanLine, format: 'number', indicator: 'up', indicatorValue: '1' },
  { key: 'overallAttendance', label: 'Attendance Rate', icon: Activity, format: 'percent', indicator: 'down', indicatorValue: '2%' },
  { key: 'pendingViolations', label: 'Pending Violations', icon: ShieldAlert, format: 'number', indicator: 'up', indicatorValue: '3' },
  { key: 'totalEnrollments', label: 'Total Enrollments', icon: UserPlus, format: 'number', indicator: 'up', indicatorValue: '10%' },
];

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

const violationChartConfig: ChartConfig = {
  count: { label: 'Violations', color: '#E74C3C' },
};

const courseChartConfig: ChartConfig = {
  percentage: { label: 'Attendance %', color: '#1A3C6E' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch {
    return dateStr;
  }
}

function formatTime(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
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
    default: return 'bg-muted text-muted-foreground';
  }
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
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
      {/* Charts skeleton */}
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
        <p className="text-sm text-muted-foreground">
          There was an error fetching the dashboard data. Please try again.
        </p>
      </div>
      <Button variant="outline" onClick={onRetry} className="gap-2">
        <RefreshCw className="h-4 w-4" /> Retry
      </Button>
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, format, indicator, indicatorValue,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  format?: 'number' | 'percent';
  indicator?: 'up' | 'down';
  indicatorValue?: string;
}) {
  const isUp = indicator === 'up';
  const displayValue = format === 'percent' ? `${value}%` : value.toLocaleString('en-IN');

  return (
    <Card className="gap-3 py-4 hover:shadow-md transition-shadow">
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${NAVY}12` }}>
            <Icon className="h-5 w-5" style={{ color: NAVY }} />
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
              const pct = session.expectedCount > 0
                ? Math.round((session.presentCount / session.expectedCount) * 100)
                : 0;
              const MethodIcon = getMethodIcon(session.captureMethod);
              return (
                <div key={session.id} className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="text-[10px] font-semibold" style={{ backgroundColor: NAVY, color: '#fff' }}>
                        {session.course.code}
                      </Badge>
                      <span className="text-sm font-medium">{session.course.name}</span>
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
                  <p className="text-[10px] text-muted-foreground">Started by {session.creator.name}</p>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ─── Course Attendance Bar Chart ─────────────────────────────────────────────

function CourseAttendanceChart({ data }: { data: CourseAttendance[] }) {
  const chartData = data.map((c) => ({
    code: c.code,
    percentage: c.percentage,
    name: c.name,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Course-wise Attendance</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={courseChartConfig} className="h-64 w-full">
          <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -4 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="code"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              className="fill-muted-foreground"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              fontSize={11}
              domain={[0, 100]}
              className="fill-muted-foreground"
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, _name, item) => (
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{item.payload.name}</span>
                      <span>{value}% attendance</span>
                    </div>
                  )}
                />
              }
            />
            <Bar
              dataKey="percentage"
              fill={NAVY}
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ─── Capture Methods Donut Chart ─────────────────────────────────────────────

function CaptureMethodsChart({ data }: { data: Record<string, number> }) {
  const chartData = Object.entries(data).map(([method, count]) => ({
    method,
    count,
    fill: captureMethodConfig[method]?.color || '#94A3B8',
  }));
  const total = chartData.reduce((s, d) => s + d.count, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Capture Method Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={captureChartConfig} className="h-64 w-full">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="method"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={3}
              strokeWidth={2}
              stroke="var(--background)"
            >
              {chartData.map((entry) => (
                <Cell key={entry.method} fill={entry.fill} />
              ))}
            </Pie>
            <RechartsTooltip
              content={({ active, payload }) => {
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
              }}
            />
            <ChartLegend
              content={
                <ChartLegendContent
                  nameKey="method"
                  className="flex-wrap gap-x-4 gap-y-1 text-[11px]"
                />
              }
            />
          </PieChart>
        </ChartContainer>
        {/* Custom legend items with icons */}
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

// ─── Weekly Trend Stacked Bar Chart ──────────────────────────────────────────

function WeeklyTrendChart({ data }: { data: WeeklyTrend[] }) {
  const chartData = data.map((d) => ({
    ...d,
    date: formatDate(d.date),
  }));

  return (
    <Card className="lg:col-span-2">
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
      <CardContent>
        <ChartContainer config={weeklyChartConfig} className="h-56 w-full">
          <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -4 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              className="fill-muted-foreground"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              fontSize={11}
              className="fill-muted-foreground"
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="present" stackId="a" fill="#2ECC71" radius={[0, 0, 0, 0]} maxBarSize={36} />
            <Bar dataKey="late" stackId="a" fill="#F39C12" radius={[0, 0, 0, 0]} maxBarSize={36} />
            <Bar dataKey="absent" stackId="a" fill="#E74C3C" radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ─── Violations By Type Chart ────────────────────────────────────────────────

function ViolationsChart({
  byType,
  bySeverity,
}: {
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
}) {
  const typeLabels: Record<string, string> = {
    spoofing: 'Spoofing',
    proxy: 'Proxy Attendance',
    face_mismatch: 'Face Mismatch',
    location_spoof: 'Location Spoof',
    multiple_device: 'Multi-Device',
  };

  const chartData = Object.entries(byType).map(([type, count]) => ({
    type: typeLabels[type] || type,
    count,
  }));

  const severityData = Object.entries(bySeverity).map(([sev, count]) => ({
    severity: sev.charAt(0).toUpperCase() + sev.slice(1),
    count,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Violations Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ChartContainer config={violationChartConfig} className="h-36 w-full">
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} className="fill-muted-foreground" />
            <YAxis
              type="category"
              dataKey="type"
              tickLine={false}
              axisLine={false}
              fontSize={10}
              width={90}
              className="fill-muted-foreground"
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="#E74C3C" radius={[0, 4, 4, 0]} maxBarSize={20} />
          </BarChart>
        </ChartContainer>
        <Separator />
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Severity Breakdown</p>
          {severityData.map((item) => (
            <div key={item.severity} className="flex items-center justify-between text-xs">
              <Badge variant="outline" className={getSeverityColor(item.severity.toLowerCase())}>
                {item.severity}
              </Badge>
              <span className="font-medium">{item.count}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Recent Activity Feed ────────────────────────────────────────────────────

function RecentActivityFeed({ activities }: { activities: RecentActivity[] }) {
  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No recent activity recorded</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Recent Activity</CardTitle>
          <Badge variant="secondary" className="text-[10px]">
            {activities.length} records
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-96">
          <div className="space-y-1">
            {activities.map((activity, idx) => {
              const MethodIcon = getMethodIcon(activity.captureMethod);
              return (
                <div key={activity.id} className="relative flex gap-3 pb-3">
                  {/* Timeline line */}
                  {idx < activities.length - 1 && (
                    <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />
                  )}
                  {/* Timeline dot */}
                  <div className="mt-1 h-[30px] w-[30px] shrink-0 rounded-full border bg-background flex items-center justify-center z-10">
                    <MethodIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{activity.student.name}</span>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${getStatusColor(activity.status)}`}>
                        {activity.status}
                      </Badge>
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

// ─── Main Dashboard Section ──────────────────────────────────────────────────

export default function DashboardSection() {
  const { data, isLoading, isError, refetch } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => fetch('/api/dashboard').then((r) => {
      if (!r.ok) throw new Error('Failed to fetch dashboard data');
      return r.json();
    }),
    refetchInterval: 30000,
    staleTime: 15000,
  });

  if (isLoading) return <DashboardSkeleton />;
  if (isError || !data) return <DashboardError onRetry={() => refetch()} />;

  const { stats, courseAttendance, captureMethods, weeklyTrend, recentActivity, activeSessionsList, violationByType, violationBySeverity } = data;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: NAVY }}>
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            University of Hyderabad &mdash; Smart Campus Management System
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 w-fit">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <StatCard
            key={card.key}
            label={card.label}
            value={stats[card.key]}
            icon={card.icon}
            format={card.format}
            indicator={card.indicator}
            indicatorValue={card.indicatorValue}
          />
        ))}
      </div>

      {/* Active Sessions + Violations Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ActiveSessionsCard sessions={activeSessionsList} />
        <ViolationsChart byType={violationByType} bySeverity={violationBySeverity} />
        {/* Quick Stats Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Attendance Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                    Present
                  </span>
                  <span className="font-semibold">{stats.totalPresent}</span>
                </div>
                <Progress value={stats.totalPresent + stats.totalAbsent + stats.totalLate > 0 ? (stats.totalPresent / (stats.totalPresent + stats.totalAbsent + stats.totalLate)) * 100 : 0} className="h-2" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                    Absent
                  </span>
                  <span className="font-semibold">{stats.totalAbsent}</span>
                </div>
                <Progress value={stats.totalPresent + stats.totalAbsent + stats.totalLate > 0 ? (stats.totalAbsent / (stats.totalPresent + stats.totalAbsent + stats.totalLate)) * 100 : 0} className="h-2 [&>[data-slot=progress-indicator]]:bg-red-500" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    Late
                  </span>
                  <span className="font-semibold">{stats.totalLate}</span>
                </div>
                <Progress value={stats.totalPresent + stats.totalAbsent + stats.totalLate > 0 ? (stats.totalLate / (stats.totalPresent + stats.totalAbsent + stats.totalLate)) * 100 : 0} className="h-2 [&>[data-slot=progress-indicator]]:bg-amber-500" />
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="space-y-1">
                <p className="text-lg font-bold" style={{ color: NAVY }}>{stats.totalSessions}</p>
                <p className="text-[10px] text-muted-foreground">Total Sessions</p>
              </div>
              <div className="space-y-1">
                <p className="text-lg font-bold text-green-600">{stats.activeSessions}</p>
                <p className="text-[10px] text-muted-foreground">Active Now</p>
              </div>
              <div className="space-y-1">
                <p className="text-lg font-bold text-amber-600">{stats.overallAttendance}%</p>
                <p className="text-[10px] text-muted-foreground">Overall Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1: Course Attendance + Capture Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CourseAttendanceChart data={courseAttendance} />
        <CaptureMethodsChart data={captureMethods} />
      </div>

      {/* Charts Row 2: Weekly Trend (full width) */}
      <WeeklyTrendChart data={weeklyTrend} />

      {/* Recent Activity Feed */}
      <RecentActivityFeed activities={recentActivity} />
    </div>
  );
}
