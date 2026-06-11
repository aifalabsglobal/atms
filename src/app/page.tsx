'use client';

import { useAppStore, type Section } from '@/lib/store';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, ScanLine, BookOpen, Users, ShieldAlert,
  BarChart3, MapPin, Settings, Menu, X, Bell, ChevronDown,
  GraduationCap, LogOut, Moon, Sun, Search
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Toaster } from '@/components/ui/toaster';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { Providers } from '@/components/providers';

// Lazy load sections for performance
const DashboardSection = dynamic(() => import('@/components/sections/dashboard-section'), { ssr: false });
const AttendanceSection = dynamic(() => import('@/components/sections/attendance-section'), { ssr: false });
const LmsSection = dynamic(() => import('@/components/sections/lms-section'), { ssr: false });
const UsersSection = dynamic(() => import('@/components/sections/users-section'), { ssr: false });
const ViolationsSection = dynamic(() => import('@/components/sections/violations-section'), { ssr: false });
const ReportsSection = dynamic(() => import('@/components/sections/reports-section'), { ssr: false });
const GeofencesSection = dynamic(() => import('@/components/sections/geofences-section'), { ssr: false });
const SettingsSection = dynamic(() => import('@/components/sections/settings-section'), { ssr: false });

const navItems: { id: Section; label: string; icon: React.ElementType; badge?: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'attendance', label: 'Attendance', icon: ScanLine },
  { id: 'lms', label: 'Learning Mgmt', icon: BookOpen },
  { id: 'users', label: 'Users & RBAC', icon: Users },
  { id: 'violations', label: 'Violations', icon: ShieldAlert, badge: 'alert' },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'geofences', label: 'Geofences', icon: MapPin },
  { id: 'settings', label: 'Settings', icon: Settings },
];

// Inner component that uses useQuery - must be inside Providers
function AppContent() {
  const { activeSection, setActiveSection, sidebarOpen, setSidebarOpen } = useAppStore();
  const { theme, setTheme } = useTheme();

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => fetch('/api/notifications').then(r => r.json()),
    refetchInterval: 30000,
  });

  const unreadCount = notifData?.unreadCount || 0;

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard': return <DashboardSection />;
      case 'attendance': return <AttendanceSection />;
      case 'lms': return <LmsSection />;
      case 'users': return <UsersSection />;
      case 'violations': return <ViolationsSection />;
      case 'reports': return <ReportsSection />;
      case 'geofences': return <GeofencesSection />;
      case 'settings': return <SettingsSection />;
      default: return <DashboardSection />;
    }
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen flex flex-col bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 flex items-center justify-between h-14 px-4 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-[#1A3C6E] flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-sm font-bold leading-tight text-[#1A3C6E]">UoH SCMS</span>
                <span className="text-[10px] text-muted-foreground leading-tight">Smart Campus Management</span>
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search students, courses, sessions..." className="pl-9 h-9 bg-muted/50" />
            </div>
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
                    <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 text-[10px] flex items-center justify-center bg-destructive text-destructive-foreground">
                      {unreadCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="p-3 font-semibold text-sm">Notifications</div>
                <DropdownMenuSeparator />
                {(notifData?.notifications || []).slice(0, 5).map((n: { id: string; title: string; message: string; type: string; isRead: boolean; createdAt: string }) => (
                  <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-1 p-3 cursor-pointer">
                    <div className="flex items-center gap-2 w-full">
                      <span className={cn("text-sm font-medium", !n.isRead && "text-primary")}>{n.title}</span>
                      {!n.isRead && <span className="h-2 w-2 rounded-full bg-primary ml-auto" />}
                    </div>
                    <span className="text-xs text-muted-foreground line-clamp-2">{n.message}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-center text-sm text-primary cursor-pointer justify-center">
                  View all notifications
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 gap-2 pl-2 pr-1">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-[#1A3C6E] text-white text-xs">RK</AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:block text-sm">Dr. Ramesh</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="p-2">
                  <p className="text-sm font-medium">Dr. Ramesh Kumar</p>
                  <p className="text-xs text-muted-foreground">admin@uohyd.ac.in</p>
                  <Badge variant="secondary" className="mt-1 text-[10px]">Super Admin</Badge>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Users className="mr-2 h-4 w-4" /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveSection('settings')}>
                  <Settings className="mr-2 h-4 w-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className={cn(
            "border-r bg-card transition-all duration-300 flex flex-col",
            "md:relative md:translate-x-0",
            sidebarOpen ? "w-56 translate-x-0 fixed inset-y-0 top-14 z-40 md:z-0" : "w-0 -translate-x-full md:w-56 md:translate-x-0"
          )}>
            {sidebarOpen && (
              <div className="fixed inset-0 top-14 bg-black/20 z-[-1] md:hidden" onClick={() => setSidebarOpen(false)} />
            )}
            <ScrollArea className="flex-1 py-2">
              <nav className="flex flex-col gap-1 px-2">
                {navItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  return (
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => { setActiveSection(item.id); if (window.innerWidth < 768) setSidebarOpen(false); }}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full text-left",
                            isActive
                              ? "bg-[#1A3C6E] text-white shadow-sm"
                              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                          {item.badge === 'alert' && (
                            <Badge variant="destructive" className="ml-auto text-[10px] h-5 px-1.5">3</Badge>
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

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto">
            <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
              {renderSection()}
            </div>

            {/* Footer */}
            <footer className="border-t mt-auto">
              <div className="px-4 md:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>© 2026 University of Hyderabad — Smart Campus Management System</span>
                <div className="flex items-center gap-4">
                  <span>Powered by <strong className="text-[#1A3C6E]">UoH SCMS</strong></span>
                  <Separator orientation="vertical" className="h-3" />
                  <span>IT Department</span>
                </div>
              </div>
            </footer>
          </main>
        </div>
        <Toaster />
      </div>
    </TooltipProvider>
  );
}

export default function HomePage() {
  return (
    <Providers>
      <AppContent />
    </Providers>
  );
}
