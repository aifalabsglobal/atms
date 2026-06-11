'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CalendarDays, Clock, MapPin, User, GraduationCap,
  ChevronLeft, ChevronRight, AlertCircle, PartyPopper, BookOpen, Flag
} from 'lucide-react';
import { useState, useMemo } from 'react';

const EVENT_TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  academic: { label: 'Academic', color: '#22c55e', icon: GraduationCap },
  exam: { label: 'Examination', color: '#ef4444', icon: BookOpen },
  holiday: { label: 'Holiday', color: '#f59e0b', icon: PartyPopper },
  event: { label: 'Event', color: '#8b5cf6', icon: PartyPopper },
  deadline: { label: 'Deadline', color: '#ec4899', icon: AlertCircle },
  personal: { label: 'Personal', color: '#6366f1', icon: User },
  class: { label: 'Class', color: '#06b6d4', icon: Clock },
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function CalendarSection() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const { data: eventsData, isLoading } = useQuery({
    queryKey: ['calendar-events', currentYear],
    queryFn: () => fetch('/api/calendar?limit=100').then(r => r.json()),
  });

  const events = eventsData?.events || [];

  // Group events by month
  const eventsByMonth = useMemo(() => {
    const grouped: Record<string, typeof events> = {};
    events.forEach((event: any) => {
      const date = new Date(event.startDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(event);
    });
    return grouped;
  }, [events]);

  // Filtered events for current month
  const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const monthEvents = (eventsByMonth[currentMonthKey] || []).filter(
    (e: any) => !selectedType || e.type === selectedType
  );

  // Calendar grid data
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const prevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();

  // Get events for a specific day
  const getEventsForDay = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter((e: any) => e.startDate === dateStr);
  };

  // Stats
  const eventTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach((e: any) => {
      counts[e.type] = (counts[e.type] || 0) + 1;
    });
    return counts;
  }, [events]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-[#1A3C6E]" />
            Academic Calendar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            JNTUH Engineering College — AY 2025-2026 R22 Regulation
          </p>
        </div>
      </div>

      {/* Event Type Filter Badges */}
      <div className="flex flex-wrap gap-2">
        <Badge
          variant={selectedType === null ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => setSelectedType(null)}
        >
          All ({events.length})
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {MONTHS[currentMonth]} {currentYear}
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setCurrentDate(new Date())}>
                  Today
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
                  {day}
                </div>
              ))}
            </div>
            {/* Calendar cells */}
            <div className="grid grid-cols-7 gap-1">
              {blanks.map(i => (
                <div key={`blank-${i}`} className="h-16 sm:h-20" />
              ))}
              {days.map(day => {
                const dayEvents = getEventsForDay(day);
                return (
                  <div
                    key={day}
                    className={`h-16 sm:h-20 border rounded-md p-1 text-xs overflow-hidden ${
                      isToday(day) ? 'border-[#1A3C6E] bg-[#1A3C6E]/5' : 'border-border/50'
                    }`}
                  >
                    <div className={`font-medium ${isToday(day) ? 'text-[#1A3C6E]' : ''}`}>
                      {day}
                    </div>
                    <div className="space-y-0.5 mt-0.5">
                      {dayEvents.slice(0, 2).map((event: any) => {
                        const config = EVENT_TYPE_CONFIG[event.type] || EVENT_TYPE_CONFIG.personal;
                        return (
                          <div
                            key={event.id}
                            className="truncate text-[10px] px-1 rounded-sm text-white"
                            style={{ backgroundColor: config.color }}
                            title={event.title}
                          >
                            {event.title}
                          </div>
                        );
                      })}
                      {dayEvents.length > 2 && (
                        <div className="text-[10px] text-muted-foreground pl-1">
                          +{dayEvents.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Events This Month</CardTitle>
            <CardDescription>
              {monthEvents.length} event{monthEvents.length !== 1 ? 's' : ''} in {MONTHS[currentMonth]}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[500px]">
              {monthEvents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No events this month
                </div>
              ) : (
                <div className="space-y-3">
                  {monthEvents.map((event: any) => {
                    const config = EVENT_TYPE_CONFIG[event.type] || EVENT_TYPE_CONFIG.personal;
                    const Icon = config.icon;
                    return (
                      <div key={event.id} className="flex gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                        <div
                          className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${config.color}15` }}
                        >
                          <Icon className="h-5 w-5" style={{ color: config.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{event.title}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span>{event.startDate}</span>
                            {event.startTime && (
                              <>
                                <span>·</span>
                                <span>{event.startTime}{event.endTime ? ` - ${event.endTime}` : ''}</span>
                              </>
                            )}
                          </div>
                          {event.location && (
                            <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">{event.location}</span>
                            </div>
                          )}
                          <Badge variant="outline" className="mt-1.5 text-[10px]" style={{ color: config.color, borderColor: config.color }}>
                            {config.label}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
