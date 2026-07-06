'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore, useCanEditCalendar } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  CalendarDays, Clock, MapPin, User, GraduationCap,
  ChevronLeft, ChevronRight, AlertCircle, PartyPopper, BookOpen, Plus, Loader2, Trash2,
  List, Pencil,
} from 'lucide-react';
import { useState, useMemo, useEffect, useRef } from 'react';
import type { Role } from '@/lib/store';
import { cn } from '@/lib/utils';

const NAVY = '#1A3C6E';
const AY_START = '2025-07-01';
const AY_END = '2026-06-30';

type SemesterFilter = 'all' | 'odd' | 'even';

const SEMESTER_RANGES: Record<Exclude<SemesterFilter, 'all'>, {
  start: string;
  end: string;
  label: string;
  shortLabel: string;
  jumpYear: number;
  jumpMonth: number;
}> = {
  odd: {
    start: '2025-07-01',
    end: '2025-12-15',
    label: 'I Sem (Odd)',
    shortLabel: 'Jul–Dec 2025',
    jumpYear: 2025,
    jumpMonth: 8,
  },
  even: {
    start: '2025-12-01',
    end: '2026-06-30',
    label: 'II Sem (Even)',
    shortLabel: 'Dec 2025–Jun 2026',
    jumpYear: 2026,
    jumpMonth: 1,
  },
};

const EVENT_TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  academic: { label: 'Academic', color: '#22c55e', icon: GraduationCap },
  exam: { label: 'Examination', color: '#ef4444', icon: BookOpen },
  holiday: { label: 'Holiday', color: '#f59e0b', icon: PartyPopper },
  event: { label: 'Event', color: '#8b5cf6', icon: PartyPopper },
  deadline: { label: 'Deadline', color: '#ec4899', icon: AlertCircle },
  personal: { label: 'Personal', color: '#6366f1', icon: User },
  class: { label: 'Class', color: '#06b6d4', icon: Clock },
};

const FORM_EVENT_TYPES = ['academic', 'exam', 'holiday', 'event', 'deadline', 'class'] as const;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const QUICK_MONTHS: { label: string; year: number; month: number }[] = [
  { label: 'Jul', year: 2025, month: 6 },
  { label: 'Aug', year: 2025, month: 7 },
  { label: 'Sep', year: 2025, month: 8 },
  { label: 'Oct', year: 2025, month: 9 },
  { label: 'Nov', year: 2025, month: 10 },
  { label: 'Dec', year: 2025, month: 11 },
  { label: 'Jan', year: 2026, month: 0 },
  { label: 'Feb', year: 2026, month: 1 },
  { label: 'Mar', year: 2026, month: 2 },
  { label: 'Apr', year: 2026, month: 3 },
  { label: 'May', year: 2026, month: 4 },
  { label: 'Jun', year: 2026, month: 5 },
];

type FormEventType = (typeof FORM_EVENT_TYPES)[number];

interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  startDate: string;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  academicYear?: { id: string; name: string; code: string; regulation: string } | null;
}

interface EventFormState {
  title: string;
  description: string;
  type: FormEventType;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  location: string;
}

const EMPTY_FORM: EventFormState = {
  title: '',
  description: '',
  type: 'academic',
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
  location: '',
};

function monthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function dateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function eventEndDate(event: CalendarEvent) {
  return event.endDate || event.startDate;
}

function eventOnDate(event: CalendarEvent, target: string) {
  return target >= event.startDate && target <= eventEndDate(event);
}

function eventInMonth(event: CalendarEvent, year: number, month: number) {
  const mk = monthKey(year, month);
  const monthStart = `${mk}-01`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthEnd = `${mk}-${String(daysInMonth).padStart(2, '0')}`;
  return event.startDate <= monthEnd && eventEndDate(event) >= monthStart;
}

function eventInRange(event: CalendarEvent, rangeStart: string, rangeEnd: string) {
  return event.startDate <= rangeEnd && eventEndDate(event) >= rangeStart;
}

function sortByStartDate(a: CalendarEvent, b: CalendarEvent) {
  return a.startDate.localeCompare(b.startDate) || (a.startTime || '').localeCompare(b.startTime || '');
}

function formatDisplayDate(startDate: string, endDate?: string | null) {
  const fmt = (d: string, withYear = true) =>
    new Date(`${d}T12:00:00`).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      ...(withYear ? { year: 'numeric' } : {}),
    });
  if (!endDate || endDate === startDate) return fmt(startDate);
  return `${fmt(startDate, false)} – ${fmt(endDate)}`;
}

function EventTypeBadge({ type }: { type: string }) {
  const config = EVENT_TYPE_CONFIG[type] || EVENT_TYPE_CONFIG.personal;
  return (
    <Badge variant="outline" className="text-[10px]" style={{ color: config.color, borderColor: config.color }}>
      {config.label}
    </Badge>
  );
}

function EventCard({
  event,
  onClick,
  compact = false,
}: {
  event: CalendarEvent;
  onClick?: () => void;
  compact?: boolean;
}) {
  const config = EVENT_TYPE_CONFIG[event.type] || EVENT_TYPE_CONFIG.personal;
  const Icon = config.icon;
  return (
    <div
      className={cn(
        'flex gap-3 rounded-lg border p-3 transition-colors',
        onClick && 'cursor-pointer hover:bg-muted/40',
        compact && 'p-2 gap-2',
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <div
        className={cn('rounded-lg flex items-center justify-center shrink-0', compact ? 'h-8 w-8' : 'h-10 w-10')}
        style={{ backgroundColor: `${config.color}15` }}
      >
        <Icon className={cn(compact ? 'h-4 w-4' : 'h-5 w-5')} style={{ color: config.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('font-medium truncate', compact ? 'text-xs' : 'text-sm')}>{event.title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {formatDisplayDate(event.startDate, event.endDate)}
          {event.startTime && (
            <span> · {event.startTime}{event.endTime ? `–${event.endTime}` : ''}</span>
          )}
        </p>
        {event.location && (
          <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{event.location}</span>
          </div>
        )}
        {!compact && <div className="mt-1.5"><EventTypeBadge type={event.type} /></div>}
      </div>
    </div>
  );
}

export default function CalendarSection() {
  const { currentUser } = useAppStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [semesterFilter, setSemesterFilter] = useState<SemesterFilter>('all');
  const [viewMode, setViewMode] = useState<'month' | 'agenda'>('month');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);
  const [dayDialogDate, setDayDialogDate] = useState<string | null>(null);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState<EventFormState>(EMPTY_FORM);
  const monthInitialized = useRef(false);

  const canEditCalendar = useCanEditCalendar();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const todayStr = dateStr(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  const { data: eventsData, isLoading, isError } = useQuery({
    queryKey: ['calendar-events', AY_START, AY_END],
    queryFn: () =>
      fetch(`/api/calendar?startDate=${AY_START}&endDate=${AY_END}&limit=500`).then((r) => {
        if (!r.ok) throw new Error('Failed to load calendar');
        return r.json();
      }),
  });

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create event');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast({ title: 'Event created' });
      setDialogOpen(false);
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch('/api/calendar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update event');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast({ title: 'Event updated' });
      setDialogOpen(false);
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/calendar?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete event');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast({ title: 'Event deleted' });
      setDeleteOpen(false);
      setDialogOpen(false);
      setDetailEvent(null);
      setEditEvent(null);
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const allEvents: CalendarEvent[] = eventsData?.events || [];

  const filteredEvents = useMemo(() => {
    let events = allEvents;
    if (semesterFilter !== 'all') {
      const range = SEMESTER_RANGES[semesterFilter];
      events = events.filter((e) => eventInRange(e, range.start, range.end));
    }
    if (selectedType) {
      events = events.filter((e) => e.type === selectedType);
    }
    return events;
  }, [allEvents, selectedType, semesterFilter]);

  const semesterEvents = useMemo(() => {
    if (semesterFilter === 'all') return [];
    return filteredEvents.sort(sortByStartDate);
  }, [filteredEvents, semesterFilter]);

  const monthEvents = useMemo(() => {
    return filteredEvents
      .filter((e) => eventInMonth(e, currentYear, currentMonth))
      .sort(sortByStartDate);
  }, [filteredEvents, currentYear, currentMonth]);

  const upcomingEvents = useMemo(() => {
    return filteredEvents
      .filter((e) => eventEndDate(e) >= todayStr)
      .sort(sortByStartDate)
      .slice(0, 8);
  }, [filteredEvents, todayStr]);

  const eventTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const base = semesterFilter === 'all'
      ? allEvents
      : allEvents.filter((e) => eventInRange(e, SEMESTER_RANGES[semesterFilter].start, SEMESTER_RANGES[semesterFilter].end));
    base.forEach((e) => {
      counts[e.type] = (counts[e.type] || 0) + 1;
    });
    return counts;
  }, [allEvents, semesterFilter]);

  const handleSemesterChange = (value: SemesterFilter) => {
    setSemesterFilter(value);
    if (value !== 'all') {
      const range = SEMESTER_RANGES[value];
      setCurrentDate(new Date(range.jumpYear, range.jumpMonth, 1));
    }
  };

  const aySubtitle = useMemo(() => {
    const ay = allEvents.find((e) => e.academicYear)?.academicYear;
    if (ay) return `${ay.name} · ${ay.regulation} Regulation`;
    return 'AY 2025-2026 · R22 Regulation';
  }, [allEvents]);

  // Jump to a useful month when the current one is empty on first load
  useEffect(() => {
    if (monthInitialized.current || isLoading || allEvents.length === 0) return;
    const hasCurrentMonth = allEvents.some((e) => eventInMonth(e, currentYear, currentMonth));
    if (hasCurrentMonth) {
      monthInitialized.current = true;
      return;
    }
    const upcoming = allEvents.filter((e) => eventEndDate(e) >= todayStr).sort(sortByStartDate)[0];
    const fallback = upcoming || allEvents.sort(sortByStartDate)[0];
    if (fallback) {
      const [y, m] = fallback.startDate.split('-').map(Number);
      setCurrentDate(new Date(y, m - 1, 1));
    }
    monthInitialized.current = true;
  }, [allEvents, isLoading, currentYear, currentMonth, todayStr]);

  const openCreate = (prefillDate?: string) => {
    setEditEvent(null);
    setForm({
      ...EMPTY_FORM,
      startDate: prefillDate || '',
    });
    setDialogOpen(true);
  };

  const openEdit = (event: CalendarEvent) => {
    setDetailEvent(null);
    setEditEvent(event);
    setForm({
      title: event.title,
      description: event.description || '',
      type: (FORM_EVENT_TYPES.includes(event.type as FormEventType) ? event.type : 'event') as FormEventType,
      startDate: event.startDate,
      endDate: event.endDate || '',
      startTime: event.startTime || '',
      endTime: event.endTime || '',
      location: event.location || '',
    });
    setDialogOpen(true);
  };

  const openDetail = (event: CalendarEvent) => {
    setDetailEvent(event);
  };

  const handleSubmit = () => {
    if (!currentUser || !form.title.trim() || !form.startDate) {
      toast({ title: 'Title and start date are required', variant: 'destructive' });
      return;
    }
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      type: form.type,
      startDate: form.startDate,
      endDate: form.endDate || undefined,
      startTime: form.startTime || undefined,
      endTime: form.endTime || undefined,
      location: form.location.trim() || undefined,
    };
    if (editEvent) {
      updateMutation.mutate({ id: editEvent.id, ...payload });
    } else {
      const academicYearId = allEvents.find((e) => e.academicYear?.id)?.academicYear?.id;
      createMutation.mutate({
        userId: currentUser.id,
        ...(academicYearId ? { academicYearId } : {}),
        ...payload,
      });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const getEventsForDay = (day: number) => {
    const ds = dateStr(currentYear, currentMonth, day);
    return monthEvents.filter((e) => eventOnDate(e, ds));
  };

  const dayDialogEvents = useMemo(() => {
    if (!dayDialogDate) return [];
    return filteredEvents.filter((e) => eventOnDate(e, dayDialogDate)).sort(sortByStartDate);
  }, [dayDialogDate, filteredEvents]);

  const prevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));

  const isToday = (day: number) => dateStr(currentYear, currentMonth, day) === todayStr;

  if (!currentUser) return null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-[#1A3C6E]" />
            Academic Calendar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{aySubtitle}</p>
        </div>
        {canEditCalendar && (
          <Button onClick={() => openCreate()} className="gap-1.5 text-white" style={{ backgroundColor: NAVY }}>
            <Plus className="h-4 w-4" />
            Add Event
          </Button>
        )}
      </div>

      {/* Semester filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={semesterFilter === 'all' ? 'default' : 'outline'}
          className="h-8 text-xs"
          style={semesterFilter === 'all' ? { backgroundColor: NAVY } : {}}
          onClick={() => handleSemesterChange('all')}
        >
          Full Academic Year
        </Button>
        <Button
          size="sm"
          variant={semesterFilter === 'odd' ? 'default' : 'outline'}
          className="h-8 text-xs"
          style={semesterFilter === 'odd' ? { backgroundColor: NAVY } : {}}
          onClick={() => handleSemesterChange('odd')}
        >
          I Sem (Odd) · {SEMESTER_RANGES.odd.shortLabel}
        </Button>
        <Button
          size="sm"
          variant={semesterFilter === 'even' ? 'default' : 'outline'}
          className="h-8 text-xs"
          style={semesterFilter === 'even' ? { backgroundColor: NAVY } : {}}
          onClick={() => handleSemesterChange('even')}
        >
          II Sem (Even) · {SEMESTER_RANGES.even.shortLabel}
        </Button>
      </div>

      {/* Type filters */}
      <div className="flex flex-wrap gap-2">
        <Badge
          variant={selectedType === null ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => setSelectedType(null)}
        >
          All ({semesterFilter === 'all' ? allEvents.length : filteredEvents.length})
        </Badge>
        {Object.entries(EVENT_TYPE_CONFIG).map(([type, config]) => {
          const count = eventTypeCounts[type] || 0;
          if (count === 0) return null;
          return (
            <Badge
              key={type}
              variant={selectedType === type ? 'default' : 'outline'}
              className="cursor-pointer"
              style={selectedType === type ? { backgroundColor: config.color } : {}}
              onClick={() => setSelectedType(selectedType === type ? null : type)}
            >
              {config.label} ({count})
            </Badge>
          );
        })}
      </div>

      {/* Quick month navigation */}
      <ScrollArea className="w-full">
        <div className="flex gap-1.5 pb-1">
          {QUICK_MONTHS.map(({ label, year, month }) => {
            const active = year === currentYear && month === currentMonth;
            const count = filteredEvents.filter((e) => eventInMonth(e, year, month)).length;
            return (
              <Button
                key={`${year}-${month}`}
                variant={active ? 'default' : 'outline'}
                size="sm"
                className="h-7 px-2.5 text-xs shrink-0"
                style={active ? { backgroundColor: NAVY } : {}}
                onClick={() => setCurrentDate(new Date(year, month, 1))}
              >
                {label}
                {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
              </Button>
            );
          })}
        </div>
      </ScrollArea>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-3">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'month' | 'agenda')}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <TabsList className="h-8">
                <TabsTrigger value="month" className="text-xs gap-1 h-7">
                  <CalendarDays className="h-3.5 w-3.5" /> Month
                </TabsTrigger>
                <TabsTrigger value="agenda" className="text-xs gap-1 h-7">
                  <List className="h-3.5 w-3.5" /> Agenda
                </TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-semibold min-w-[140px] text-center">
                  {MONTHS[currentMonth]} {currentYear}
                </span>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs ml-1" onClick={() => setCurrentDate(new Date())}>
                  Today
                </Button>
              </div>
            </div>

            <TabsContent value="month" className="mt-3">
              <Card>
                <CardContent className="p-3 sm:p-4">
                  {isError ? (
                    <p className="text-sm text-destructive text-center py-8">Failed to load calendar events</p>
                  ) : isLoading ? (
                    <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-7 gap-1 mb-1">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                          <div key={day} className="text-center text-[11px] font-medium text-muted-foreground py-1">
                            {day}
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {blanks.map((i) => (
                          <div key={`blank-${i}`} className="min-h-[5.5rem] sm:min-h-[6.5rem]" />
                        ))}
                        {days.map((day) => {
                          const dayEvents = getEventsForDay(day);
                          const ds = dateStr(currentYear, currentMonth, day);
                          return (
                            <button
                              key={day}
                              type="button"
                              className={cn(
                                'min-h-[5.5rem] sm:min-h-[6.5rem] border rounded-md p-1.5 text-left text-xs overflow-hidden transition-colors hover:bg-muted/30',
                                isToday(day) ? 'border-[#1A3C6E] bg-[#1A3C6E]/5 ring-1 ring-[#1A3C6E]/20' : 'border-border/50',
                              )}
                              onClick={() => setDayDialogDate(ds)}
                            >
                              <div className={cn('font-semibold mb-1', isToday(day) && 'text-[#1A3C6E]')}>
                                {day}
                              </div>
                              <div className="space-y-0.5">
                                {dayEvents.slice(0, 3).map((event) => {
                                  const config = EVENT_TYPE_CONFIG[event.type] || EVENT_TYPE_CONFIG.personal;
                                  const isMultiDay = event.endDate && event.endDate !== event.startDate;
                                  return (
                                    <div
                                      key={event.id}
                                      className="truncate text-[9px] sm:text-[10px] px-1 py-0.5 rounded-sm text-white leading-tight"
                                      style={{ backgroundColor: config.color }}
                                      title={event.title}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openDetail(event);
                                      }}
                                    >
                                      {isMultiDay && event.startDate !== ds ? '↔ ' : ''}{event.title}
                                    </div>
                                  );
                                })}
                                {dayEvents.length > 3 && (
                                  <div className="text-[9px] text-muted-foreground pl-0.5">
                                    +{dayEvents.length - 3} more
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="agenda" className="mt-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {semesterFilter === 'all'
                      ? `${MONTHS[currentMonth]} ${currentYear} — Agenda`
                      : `${SEMESTER_RANGES[semesterFilter].label} — Full Agenda`}
                  </CardTitle>
                  <CardDescription>
                    {semesterFilter === 'all'
                      ? `${monthEvents.length} event${monthEvents.length !== 1 ? 's' : ''}`
                      : `${semesterEvents.length} events · ${SEMESTER_RANGES[semesterFilter].shortLabel}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(semesterFilter === 'all' ? monthEvents : semesterEvents).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No events for this view</p>
                  ) : (
                    <ScrollArea className={semesterFilter === 'all' ? undefined : 'max-h-[520px]'}>
                      <div className="space-y-2 pr-2">
                        {(semesterFilter === 'all' ? monthEvents : semesterEvents).map((event) => (
                          <EventCard key={event.id} event={event} onClick={() => openDetail(event)} />
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Upcoming</CardTitle>
              <CardDescription>Next events from today</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[320px]">
                {isLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin" /></div>
                ) : upcomingEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No upcoming events</p>
                ) : (
                  <div className="space-y-2 pr-2">
                    {upcomingEvents.map((event) => (
                      <EventCard key={event.id} event={event} compact onClick={() => openDetail(event)} />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {semesterFilter === 'all' ? 'This Month' : SEMESTER_RANGES[semesterFilter].label}
              </CardTitle>
              <CardDescription>
                {semesterFilter === 'all'
                  ? `${monthEvents.length} in ${MONTHS[currentMonth]}`
                  : `${semesterEvents.length} events · ${SEMESTER_RANGES[semesterFilter].shortLabel}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[280px]">
                {(semesterFilter === 'all' ? monthEvents : semesterEvents.slice(0, 12)).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No events — try another month or semester</p>
                ) : (
                  <div className="space-y-2 pr-2">
                    {(semesterFilter === 'all' ? monthEvents : semesterEvents.slice(0, 12)).map((event) => (
                      <EventCard key={event.id} event={event} compact onClick={() => openDetail(event)} />
                    ))}
                    {semesterFilter !== 'all' && semesterEvents.length > 12 && (
                      <Button variant="link" className="h-7 text-xs px-0" onClick={() => setViewMode('agenda')}>
                        View all {semesterEvents.length} events in Agenda →
                      </Button>
                    )}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Day events dialog */}
      <Dialog open={!!dayDialogDate} onOpenChange={(open) => !open && setDayDialogDate(null)}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dayDialogDate &&
                new Date(`${dayDialogDate}T12:00:00`).toLocaleDateString('en-IN', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                })}
            </DialogTitle>
            <DialogDescription>
              {dayDialogEvents.length} event{dayDialogEvents.length !== 1 ? 's' : ''} on this day
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {dayDialogEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No events</p>
            ) : (
              dayDialogEvents.map((event) => (
                <EventCard key={event.id} event={event} onClick={() => { setDayDialogDate(null); openDetail(event); }} />
              ))
            )}
          </div>
          {canEditCalendar && dayDialogDate && (
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDayDialogDate(null); openCreate(dayDialogDate); }}>
                <Plus className="h-4 w-4 mr-1.5" /> Add event on this day
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Event detail dialog (all users) */}
      <Dialog open={!!detailEvent} onOpenChange={(open) => !open && setDetailEvent(null)}>
        <DialogContent className="sm:max-w-lg">
          {detailEvent && (
            <>
              <DialogHeader>
                <DialogTitle>{detailEvent.title}</DialogTitle>
                <DialogDescription asChild>
                  <div className="flex items-center gap-2 pt-1">
                    <EventTypeBadge type={detailEvent.type} />
                  </div>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2 text-muted-foreground">
                  <CalendarDays className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{formatDisplayDate(detailEvent.startDate, detailEvent.endDate)}</span>
                </div>
                {detailEvent.startTime && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4 shrink-0" />
                    <span>{detailEvent.startTime}{detailEvent.endTime ? ` – ${detailEvent.endTime}` : ''}</span>
                  </div>
                )}
                {detailEvent.location && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span>{detailEvent.location}</span>
                  </div>
                )}
                {detailEvent.description && (
                  <p className="text-muted-foreground leading-relaxed border-t pt-3">{detailEvent.description}</p>
                )}
              </div>
              {canEditCalendar && (
                <DialogFooter>
                  <Button variant="outline" onClick={() => { openEdit(detailEvent); setDetailEvent(null); }}>
                    <Pencil className="h-4 w-4 mr-1.5" /> Edit
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create / Edit Event Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editEvent ? 'Edit Event' : 'Create Event'}</DialogTitle>
            <DialogDescription>
              {editEvent ? 'Update calendar event details' : 'Add a new event to the academic calendar'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="event-title">Title</Label>
              <Input id="event-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Event title" />
            </div>
            <div>
              <Label htmlFor="event-description">Description</Label>
              <Textarea id="event-description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional description" rows={3} />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as FormEventType }))}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {FORM_EVENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{EVENT_TYPE_CONFIG[type].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="event-start-date">Start Date</Label>
                <Input id="event-start-date" type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="event-end-date">End Date (multi-day)</Label>
                <Input id="event-end-date" type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="event-start-time">Start Time</Label>
                <Input id="event-start-time" type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="event-end-time">End Time</Label>
                <Input id="event-end-time" type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label htmlFor="event-location">Location</Label>
              <Input id="event-location" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Room, building, or venue" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            {editEvent && (
              <Button variant="destructive" className="mr-auto gap-1.5" onClick={() => setDeleteOpen(true)} disabled={deleteMutation.isPending}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSaving} className="text-white" style={{ backgroundColor: NAVY }}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editEvent ? 'Save Changes' : 'Create Event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &ldquo;{editEvent?.title}&rdquo;? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => editEvent && deleteMutation.mutate(editEvent.id)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
