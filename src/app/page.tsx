'use client';

import dynamic from 'next/dynamic';
import { useAppStore, ROLE_LABELS, ROLE_COLORS, useEffectiveSections, type Role, type Section } from '@/lib/store';
import { BrandLogo } from '@/components/brand-logo';
import { PlatformSettingsEffects } from '@/components/platform-settings-effects';
import { usePlatformSettings } from '@/hooks/use-platform-settings';
import { DEFAULT_GENERAL_SETTINGS } from '@/lib/settings/general-defaults';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, ScanLine, BookOpen, Users, ShieldAlert,
  BarChart3, MapPin, Settings, Menu, X, Bell, ChevronDown,
  LogOut, Moon, Sun, Search, Shield, UserCircle,
  Database, CalendarDays, Loader2,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { signOut, useSession } from 'next-auth/react';
import { DEMO_ACCOUNTS } from '@/lib/demo-accounts';

import { RoleSwitcherMenu } from '@/components/role-switcher-menu';
import { GlobalSearch } from '@/components/global-search';
import { DemoBanner } from '@/components/demo-banner';

function SectionFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-6 w-6 animate-spin text-[#1A3C6E]" />
    </div>
  );
}

const DashboardSection = dynamic(() => import('@/components/sections/dashboard-section'), { loading: SectionFallback });
const AttendanceSection = dynamic(() => import('@/components/sections/attendance-section'), { loading: SectionFallback });
const LmsSection = dynamic(() => import('@/components/sections/lms-section'), { loading: SectionFallback });
const UsersSection = dynamic(() => import('@/components/sections/users-section'), { loading: SectionFallback });
const ViolationsSection = dynamic(() => import('@/components/sections/violations-section'), { loading: SectionFallback });
const ReportsSection = dynamic(() => import('@/components/sections/reports-section'), { loading: SectionFallback });
const GeofencesSection = dynamic(() => import('@/components/sections/geofences-section'), { loading: SectionFallback });
const SettingsSection = dynamic(() => import('@/components/sections/settings-section'), { loading: SectionFallback });
const MastersSection = dynamic(() => import('@/components/sections/masters-section'), { loading: SectionFallback });
const CalendarSection = dynamic(() => import('@/components/sections/calendar-section'), { loading: SectionFallback });

const allNavItems: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'masters', label: 'Masters', icon: Database },
  { id: 'attendance', label: 'Attendance', icon: ScanLine },
  { id: 'lms', label: 'Learning Mgmt', icon: BookOpen },
  { id: 'users', label: 'Users & RBAC', icon: Users },
  { id: 'violations', label: 'Violations', icon: ShieldAlert },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'geofences', label: 'Geofences', icon: MapPin },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'settings', label: 'Administration', icon: Settings },
];

function LoadingScreen({ message }: { message?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-[#1A3C6E]" />
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}

function AppContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status } = useSession();
  const { activeSection, setActiveSection, sidebarOpen, setSidebarOpen, currentUser, roleSwitching } = useAppStore();
  const { theme, setTheme } = useTheme();
  const allowedSections = useEffectiveSections();
  const { data: platformGeneral } = usePlatformSettings(status === 'authenticated');
  const general = platformGeneral ?? DEFAULT_GENERAL_SETTINGS;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = `${general.appName} - ${general.tagline}`;
    }
  }, [general.appName, general.tagline]);

  const { data: notifData } = useQuery({
    queryKey: ['notifications', currentUser?.id],
    queryFn: () => fetch('/api/notifications').then((r) => {
      if (!r.ok) throw new Error('Failed to load notifications');
      return r.json();
    }),
    enabled: status === 'authenticated' && !!currentUser,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });

  const showViolationsBadge = allowedSections.includes('violations');
  const { data: violationsData } = useQuery({
    queryKey: ['violations-pending-count', currentUser?.id],
    queryFn: () => fetch('/api/attendance/violations?reviewStatus=pending&limit=1').then((r) => {
      if (!r.ok) throw new Error('Failed to load violations');
      return r.json();
    }),
    enabled: status === 'authenticated' && !!currentUser && showViolationsBadge,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 3 * 60 * 1000,
  });

  if (roleSwitching) {
    return <LoadingScreen message={`Switching to ${roleSwitching}…`} />;
  }

  if (status === 'loading' || status === 'unauthenticated' || !currentUser) {
    return <LoadingScreen message={status === 'unauthenticated' ? 'Redirecting to login…' : 'Loading your session…'} />;
  }

  const role = currentUser.role;
  const canAccessSettings = allowedSections.includes('settings');
  const isDemoUser = DEMO_ACCOUNTS.some((a) => a.email === currentUser.email);

  async function markNotificationsRead(ids?: string[]) {
    const res = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ids?.length ? { ids } : { all: true }),
    });
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ['notifications', currentUser?.id] });
    }
  }
  const allowedSectionsNav = allowedSections;
  const navItems = allNavItems.filter((item) => allowedSectionsNav.includes(item.id));
  const safeSection = allowedSectionsNav.includes(activeSection) ? activeSection : 'dashboard';

  const unreadCount = notifData?.unreadCount ?? 0;
  const pendingViolations = violationsData?.total ?? 0;

  const renderSection = () => {
    switch (safeSection) {
      case 'dashboard': return <DashboardSection />;
      case 'attendance': return <AttendanceSection />;
      case 'lms': return <LmsSection />;
      case 'users': return <UsersSection />;
      case 'violations': return <ViolationsSection />;
      case 'reports': return <ReportsSection />;
      case 'geofences': return <GeofencesSection />;
      case 'calendar': return <CalendarSection />;
      case 'masters': return <MastersSection />;
      case 'settings': return <SettingsSection />;
      default: return <DashboardSection />;
    }
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen flex flex-col bg-background">
        <PlatformSettingsEffects
          general={general}
          allowedSections={allowedSectionsNav}
          role={role}
        />
        <header className="sticky top-0 z-50 flex items-center justify-between h-14 px-4 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="flex items-center gap-2">
              <BrandLogo size="sm" priority src={general.logoUrl} alt={general.companyName} />
              <div className="hidden sm:flex flex-col">
                <span
                  className="text-sm font-bold leading-tight"
                  style={{ color: general.brandingPrimaryColor }}
                >
                  {general.appName}
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight">{general.tagline}</span>
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
            <GlobalSearch />
          </div>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                  <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle theme</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 relative">
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-0.5 text-[10px] font-bold flex items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="p-3 flex items-center justify-between">
                  <span className="font-semibold text-sm">Notifications</span>
                  {unreadCount > 0 && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => markNotificationsRead()}>
                      Mark all read
                    </Button>
                  )}
                </div>
                <DropdownMenuSeparator />
                {(notifData?.notifications || []).slice(0, 5).map((n: { id: string; title: string; message: string; isRead: boolean }) => (
                  <DropdownMenuItem
                    key={n.id}
                    className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                    onClick={() => { if (!n.isRead) markNotificationsRead([n.id]); }}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <span className={cn('text-sm font-medium', !n.isRead && 'text-primary')}>{n.title}</span>
                      {!n.isRead && <span className="h-2 w-2 rounded-full bg-primary ml-auto" />}
                    </div>
                    <span className="text-xs text-muted-foreground line-clamp-2">{n.message}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="h-8 gap-1.5 text-xs border-dashed hidden sm:flex cursor-default">
                  <Shield className="h-3.5 w-3.5" />
                  {ROLE_LABELS[role]}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Use avatar menu → Switch demo role</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 gap-2 pl-2 pr-1">
                  <Avatar className="h-7 w-7">
                    {currentUser.profileImageUrl && <AvatarImage src={currentUser.profileImageUrl} alt={currentUser.name} />}
                    <AvatarFallback className="text-white text-xs" style={{ backgroundColor: ROLE_COLORS[role] }}>
                      {currentUser.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:block text-sm max-w-[100px] truncate">{currentUser.name.split(' ')[0]}</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="p-2 flex items-center gap-3">
                  <Avatar className="h-12 w-12 border-2" style={{ borderColor: ROLE_COLORS[role] }}>
                    {currentUser.profileImageUrl && <AvatarImage src={currentUser.profileImageUrl} alt={currentUser.name} />}
                    <AvatarFallback className="text-white text-sm" style={{ backgroundColor: ROLE_COLORS[role] }}>
                      {currentUser.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{currentUser.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{currentUser.email}</p>
                    <Badge className="mt-1 text-[10px] text-white" style={{ backgroundColor: ROLE_COLORS[role] }}>
                      {ROLE_LABELS[role]}
                    </Badge>
                  </div>
                </div>
                <DropdownMenuSeparator />
                {isDemoUser && <RoleSwitcherMenu />}
                {canAccessSettings && (
                  <DropdownMenuItem onClick={() => setActiveSection('settings')}>
                    <Settings className="mr-2 h-4 w-4" /> Administration
                  </DropdownMenuItem>
                )}
                {(isDemoUser || canAccessSettings) && <DropdownMenuSeparator />}
                <DropdownMenuItem className="text-destructive" onClick={() => signOut({ callbackUrl: '/login' })}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <aside className={cn(
            'border-r bg-card transition-all duration-300 flex flex-col',
            'md:relative md:translate-x-0',
            sidebarOpen ? 'w-56 translate-x-0 fixed inset-y-0 top-14 z-40 md:z-0' : 'w-0 -translate-x-full md:w-56 md:translate-x-0'
          )}>
            {sidebarOpen && (
              <div className="fixed inset-0 top-14 bg-black/20 z-[-1] md:hidden" onClick={() => setSidebarOpen(false)} />
            )}
            <ScrollArea className="flex-1 py-2">
              <div className="px-3 mb-2">
                <div className="rounded-lg border bg-muted/30 p-2.5 flex items-center gap-2">
                  <Avatar className="h-7 w-7 border" style={{ borderColor: ROLE_COLORS[role] }}>
                    {currentUser.profileImageUrl && <AvatarImage src={currentUser.profileImageUrl} alt={currentUser.name} />}
                    <AvatarFallback className="text-[10px] font-bold text-white" style={{ backgroundColor: ROLE_COLORS[role] }}>
                      {currentUser.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium truncate">{currentUser.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{ROLE_LABELS[role]}</p>
                  </div>
                </div>
              </div>
              <Separator className="mb-2" />
              {isDemoUser && <RoleSwitcherMenu variant="sidebar" />}
              <nav className="flex flex-col gap-1 px-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = safeSection === item.id;
                  return (
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => { setActiveSection(item.id); if (window.innerWidth < 768) setSidebarOpen(false); }}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full text-left',
                            isActive
                              ? 'bg-[#1A3C6E] text-white shadow-sm'
                              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                          {item.id === 'violations' && pendingViolations > 0 && (
                            <span className="ml-auto h-5 min-w-[20px] px-1 text-[10px] font-bold flex items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                              {pendingViolations > 99 ? '99+' : pendingViolations}
                            </span>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="md:hidden">{item.label}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </nav>
            </ScrollArea>

            <div className="p-3 border-t">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-xs text-muted-foreground">System Online</span>
                <span className="ml-auto text-[10px] text-muted-foreground">v1.0</span>
              </div>
            </div>
          </aside>

          <main className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-[1600px] mx-auto w-full">
              <DemoBanner />
              {renderSection()}
            </div>
            <footer className="border-t shrink-0">
              <div className="px-4 md:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{general.copyrightText}</span>
                <div className="flex items-center gap-4">
                  <span>
                    Powered by{' '}
                    <strong style={{ color: general.brandingPrimaryColor }}>{general.appName}</strong>
                  </span>
                  <Separator orientation="vertical" className="h-3" />
                  <span className="truncate max-w-[240px]" title={general.companyName}>
                    {general.companyName}
                  </span>
                </div>
              </div>
            </footer>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default function HomePage() {
  return <AppContent />;
}
