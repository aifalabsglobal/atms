'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ScanLine, Plus, PenLine, ScanFace, MapPin, QrCode,
  Fingerprint, Radio, CalendarIcon, ChevronLeft, ChevronRight,
  MoreHorizontal, Eye, Trash2, Clock, Users, CheckCircle2,
  XCircle, AlertTriangle, Loader2, Search,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

// ─── Types ──────────────────────────────────────────────────────
interface CourseOption {
  id: string;
  name: string;
  code: string;
}

interface GeofenceOption {
  id: string;
  name: string;
}

interface AttendanceSession {
  id: string;
  sessionDate: string;
  startTime: string;
  endTime: string | null;
  captureMethod: string;
  status: string;
  expectedCount: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  courseId: string;
  createdBy: string;
  geofenceId: string | null;
  timetableSlotId: string | null;
  course: { name: string; code: string };
  creator: { name: string };
  geofence: { name: string } | null;
  timetableSlot: { roomNumber: string | null; building: string | null; startTime: string; endTime: string } | null;
  _count: { records: number };
}

interface SessionsResponse {
  sessions: AttendanceSession[];
  total: number;
  page: number;
  limit: number;
  summary: {
    totalSessions: number;
    activeCount: number;
    completedCount: number;
    avgAttendanceRate: number;
  };
}

// ─── Constants ──────────────────────────────────────────────────
const UOH_NAVY = '#1A3C6E';

const CAPTURE_METHOD_CONFIG: Record<string, { icon: React.ElementType; label: string }> = {
  manual: { icon: PenLine, label: 'Manual' },
  face: { icon: ScanFace, label: 'Face' },
  gps: { icon: MapPin, label: 'GPS' },
  qrcode: { icon: QrCode, label: 'QR Code' },
  biometric: { icon: Fingerprint, label: 'Biometric' },
  beacon: { icon: Radio, label: 'Beacon' },
};

const STATUS_CONFIG: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string; label: string }> = {
  upcoming: { variant: 'secondary', className: '', label: 'Upcoming' },
  active: { variant: 'default', className: 'bg-green-600 hover:bg-green-600 text-white', label: 'Active' },
  completed: { variant: 'default', className: '', label: 'Completed' },
  cancelled: { variant: 'destructive', className: '', label: 'Cancelled' },
};

// ─── Helper ─────────────────────────────────────────────────────
function getAttendanceColor(rate: number) {
  if (rate >= 75) return 'text-green-600';
  if (rate >= 65) return 'text-amber-600';
  return 'text-red-600';
}

function getAttendanceBarColor(rate: number) {
  if (rate >= 75) return 'bg-green-500';
  if (rate >= 65) return 'bg-amber-500';
  return 'bg-red-500';
}

// ─── Component ──────────────────────────────────────────────────
export default function AttendanceSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Filters & pagination state
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;

  // New session dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newSession, setNewSession] = useState({
    courseId: '',
    sessionDate: '',
    startTime: '09:00',
    endTime: '10:30',
    captureMethod: 'manual',
    geofenceId: '',
  });

  // ─── Queries ────────────────────────────────────────────────
  const queryParams = new URLSearchParams();
  if (statusFilter && statusFilter !== 'all') queryParams.set('status', statusFilter);
  if (courseFilter && courseFilter !== 'all') queryParams.set('courseId', courseFilter);
  if (methodFilter && methodFilter !== 'all') queryParams.set('captureMethod', methodFilter);
  if (dateFilter) queryParams.set('date', format(dateFilter, 'yyyy-MM-dd'));
  queryParams.set('page', String(page));
  queryParams.set('limit', String(limit));

  const { data, isLoading, isError } = useQuery<SessionsResponse>({
    queryKey: ['attendance-sessions', statusFilter, courseFilter, methodFilter, dateFilter, page],
    queryFn: () => fetch(`/api/attendance/sessions?${queryParams.toString()}`).then(r => {
      if (!r.ok) throw new Error('Failed to fetch sessions');
      return r.json();
    }),
  });

  const { data: coursesData } = useQuery<{ courses: CourseOption[] }>({
    queryKey: ['courses-list'],
    queryFn: () => fetch('/api/lms/courses?limit=100').then(r => r.json()),
  });

  const { data: geofencesData } = useQuery<{ geofences: GeofenceOption[] }>({
    queryKey: ['geofences-list'],
    queryFn: () => fetch('/api/geofences').then(r => r.json()),
  });

  const courses = coursesData?.courses ?? [];
  const geofences = geofencesData?.geofences ?? [];

  // ─── Mutation ───────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch('/api/attendance/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => {
        if (!r.ok) throw new Error('Failed to create session');
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
      setDialogOpen(false);
      setNewSession({
        courseId: '',
        sessionDate: '',
        startTime: '09:00',
        endTime: '10:30',
        captureMethod: 'manual',
        geofenceId: '',
      });
      toast({
        title: 'Session Created',
        description: 'The attendance session has been created successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create attendance session. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // ─── Derived ────────────────────────────────────────────────
  const summary = data?.summary;
  const sessions = data?.sessions ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));

  const summaryCards = useMemo(() => [
    {
      title: 'Total Sessions',
      value: summary?.totalSessions ?? 0,
      icon: ScanLine,
      color: UOH_NAVY,
      bgColor: 'bg-[#1A3C6E]/10',
    },
    {
      title: 'Active Sessions',
      value: summary?.activeCount ?? 0,
      icon: Clock,
      color: '#16a34a',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      title: 'Completed Sessions',
      value: summary?.completedCount ?? 0,
      icon: CheckCircle2,
      color: '#1A3C6E',
      bgColor: 'bg-[#1A3C6E]/10',
    },
    {
      title: 'Avg Attendance Rate',
      value: `${summary?.avgAttendanceRate ?? 0}%`,
      icon: Users,
      color: (summary?.avgAttendanceRate ?? 0) >= 75 ? '#16a34a' : (summary?.avgAttendanceRate ?? 0) >= 65 ? '#d97706' : '#dc2626',
      bgColor: (summary?.avgAttendanceRate ?? 0) >= 75 ? 'bg-green-100 dark:bg-green-900/30' : (summary?.avgAttendanceRate ?? 0) >= 65 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-red-100 dark:bg-red-900/30',
    },
  ], [summary]);

  // ─── Handlers ───────────────────────────────────────────────
  const handleCreateSession = () => {
    if (!newSession.courseId || !newSession.sessionDate) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }
    createMutation.mutate({
      courseId: newSession.courseId,
      createdBy: 'admin',
      sessionDate: newSession.sessionDate,
      startTime: newSession.startTime,
      endTime: newSession.endTime,
      captureMethod: newSession.captureMethod,
      geofenceId: newSession.geofenceId || undefined,
    });
  };

  const handleClearFilters = () => {
    setStatusFilter('all');
    setCourseFilter('all');
    setMethodFilter('all');
    setDateFilter(undefined);
    setPage(1);
  };

  const hasActiveFilters = statusFilter !== 'all' || courseFilter !== 'all' || methodFilter !== 'all' || dateFilter !== undefined;

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: UOH_NAVY }}>
            Attendance Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage attendance sessions, capture methods, and track student participation
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-[#1A3C6E] hover:bg-[#1A3C6E]/90 text-white">
              <Plus className="h-4 w-4" />
              New Session
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>Create Attendance Session</DialogTitle>
              <DialogDescription>
                Set up a new attendance session with capture method and schedule details.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Course */}
              <div className="grid gap-2">
                <Label htmlFor="course">Course *</Label>
                <Select
                  value={newSession.courseId}
                  onValueChange={(v) => setNewSession(prev => ({ ...prev, courseId: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Session Date */}
              <div className="grid gap-2">
                <Label htmlFor="sessionDate">Session Date *</Label>
                <Input
                  id="sessionDate"
                  type="date"
                  value={newSession.sessionDate}
                  onChange={(e) => setNewSession(prev => ({ ...prev, sessionDate: e.target.value }))}
                />
              </div>

              {/* Time Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={newSession.startTime}
                    onChange={(e) => setNewSession(prev => ({ ...prev, startTime: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="endTime">End Time</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={newSession.endTime}
                    onChange={(e) => setNewSession(prev => ({ ...prev, endTime: e.target.value }))}
                  />
                </div>
              </div>

              {/* Capture Method */}
              <div className="grid gap-2">
                <Label htmlFor="captureMethod">Capture Method</Label>
                <Select
                  value={newSession.captureMethod}
                  onValueChange={(v) => setNewSession(prev => ({ ...prev, captureMethod: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select capture method" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CAPTURE_METHOD_CONFIG).map(([key, { label, icon: Icon }]) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Geofence */}
              <div className="grid gap-2">
                <Label htmlFor="geofence">Geofence Zone (Optional)</Label>
                <Select
                  value={newSession.geofenceId}
                  onValueChange={(v) => setNewSession(prev => ({ ...prev, geofenceId: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select geofence zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {geofences.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateSession}
                disabled={createMutation.isPending}
                className="bg-[#1A3C6E] hover:bg-[#1A3C6E]/90 text-white gap-2"
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Session
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="relative overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', card.bgColor)}>
                    <Icon className="h-5 w-5" style={{ color: card.color }} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-muted-foreground truncate block">{card.title}</span>
                    <span className="text-xl font-bold mt-0.5 block" style={{ color: card.color }}>
                      {isLoading ? <Skeleton className="h-6 w-12" /> : card.value}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Search className="h-4 w-4" />
              <span>Filters:</span>
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[150px]" size="sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            {/* Course Filter */}
            <Select value={courseFilter} onValueChange={(v) => { setCourseFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[200px]" size="sm">
                <SelectValue placeholder="Course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {courses.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Capture Method Filter */}
            <Select value={methodFilter} onValueChange={(v) => { setMethodFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[160px]" size="sm">
                <SelectValue placeholder="Method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                {Object.entries(CAPTURE_METHOD_CONFIG).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date Picker */}
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'w-[180px] justify-start text-left font-normal',
                    !dateFilter && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFilter ? format(dateFilter, 'MMM dd, yyyy') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFilter}
                  onSelect={(d) => {
                    setDateFilter(d ?? undefined);
                    setDatePickerOpen(false);
                    setPage(1);
                  }}
                />
                {dateFilter && (
                  <div className="border-t p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setDateFilter(undefined);
                        setDatePickerOpen(false);
                        setPage(1);
                      }}
                    >
                      Clear Date
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters} className="text-muted-foreground">
                <XCircle className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sessions Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">
              Attendance Sessions
              {data?.total !== undefined && (
                <span className="text-muted-foreground font-normal ml-2">
                  ({data.total} total)
                </span>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertTriangle className="h-10 w-10 text-destructive mb-3" />
              <p className="text-sm font-medium">Failed to load sessions</p>
              <p className="text-xs text-muted-foreground mt-1">Please try again later</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] })}
              >
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-center">Expected</TableHead>
                    <TableHead>Present</TableHead>
                    <TableHead className="text-center">Absent</TableHead>
                    <TableHead className="text-center">Late</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 11 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full max-w-[80px]" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ScanLine className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">No sessions found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {hasActiveFilters
                  ? 'Try adjusting your filters or create a new session'
                  : 'Create your first attendance session to get started'}
              </p>
              {!hasActiveFilters && (
                <Button
                  size="sm"
                  className="mt-4 bg-[#1A3C6E] hover:bg-[#1A3C6E]/90 text-white"
                  onClick={() => setDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1" /> New Session
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-center">Expected</TableHead>
                      <TableHead className="min-w-[140px]">Present</TableHead>
                      <TableHead className="text-center">Absent</TableHead>
                      <TableHead className="text-center">Late</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => {
                      const attendanceRate = session.expectedCount > 0
                        ? Math.round((session.presentCount / session.expectedCount) * 100)
                        : 0;
                      const methodConfig = CAPTURE_METHOD_CONFIG[session.captureMethod] ?? CAPTURE_METHOD_CONFIG.manual;
                      const MethodIcon = methodConfig.icon;
                      const statusConfig = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.upcoming;
                      const room = session.timetableSlot?.roomNumber
                        ? `${session.timetableSlot.roomNumber}${session.timetableSlot.building ? `, ${session.timetableSlot.building}` : ''}`
                        : session.geofence?.name ?? '—';

                      return (
                        <TableRow key={session.id} className="group">
                          {/* Date */}
                          <TableCell className="font-medium">
                            {format(new Date(session.sessionDate + 'T00:00:00'), 'MMM dd, yyyy')}
                          </TableCell>

                          {/* Course */}
                          <TableCell>
                            <div>
                              <span className="font-medium text-xs" style={{ color: UOH_NAVY }}>
                                {session.course?.code || 'N/A'}
                              </span>
                              <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                                {session.course?.name || 'Unknown Course'}
                              </p>
                            </div>
                          </TableCell>

                          {/* Time */}
                          <TableCell className="text-xs">
                            <span>{session.startTime}</span>
                            {session.endTime && (
                              <span className="text-muted-foreground"> — {session.endTime}</span>
                            )}
                          </TableCell>

                          {/* Room */}
                          <TableCell className="text-xs text-muted-foreground">
                            {room}
                          </TableCell>

                          {/* Method */}
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <MethodIcon className="h-4 w-4 text-muted-foreground" />
                              <span className="text-xs">{methodConfig.label}</span>
                            </div>
                          </TableCell>

                          {/* Expected */}
                          <TableCell className="text-center font-medium">
                            {session.expectedCount}
                          </TableCell>

                          {/* Present with progress bar */}
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 min-w-[60px]">
                                <Progress
                                  value={attendanceRate}
                                  className="h-2"
                                />
                              </div>
                              <span className={cn('text-xs font-semibold min-w-[50px] text-right', getAttendanceColor(attendanceRate))}>
                                {session.presentCount} ({attendanceRate}%)
                              </span>
                            </div>
                          </TableCell>

                          {/* Absent */}
                          <TableCell className="text-center">
                            <span className={cn(
                              'text-xs font-medium',
                              session.absentCount > 0 ? 'text-red-600' : 'text-muted-foreground'
                            )}>
                              {session.absentCount}
                            </span>
                          </TableCell>

                          {/* Late */}
                          <TableCell className="text-center">
                            <span className={cn(
                              'text-xs font-medium',
                              session.lateCount > 0 ? 'text-amber-600' : 'text-muted-foreground'
                            )}>
                              {session.lateCount}
                            </span>
                          </TableCell>

                          {/* Status */}
                          <TableCell>
                            <Badge variant={statusConfig.variant} className={cn('text-[10px]', statusConfig.className)}>
                              {statusConfig.label}
                            </Badge>
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem className="gap-2">
                                  <Eye className="h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                  Cancel Session
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <Separator />
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, data?.total ?? 0)} of {data?.total ?? 0} sessions
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {generatePageNumbers(page, totalPages).map((p, idx) =>
                    p === '...' ? (
                      <span key={`dots-${idx}`} className="px-1 text-xs text-muted-foreground">...</span>
                    ) : (
                      <Button
                        key={p}
                        variant={page === p ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          'h-8 w-8 p-0 text-xs',
                          page === p && 'bg-[#1A3C6E] hover:bg-[#1A3C6E]/90 text-white'
                        )}
                        onClick={() => setPage(p as number)}
                      >
                        {p}
                      </Button>
                    )
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Utility ──────────────────────────────────────────────────
function generatePageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | '...')[] = [1];

  if (current > 3) pages.push('...');

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push('...');

  pages.push(total);
  return pages;
}
