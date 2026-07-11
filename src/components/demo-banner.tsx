'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Code2, Database, LayoutDashboard, Sparkles, X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DEMO_ACCOUNTS } from '@/lib/demo-accounts';
import { useAppStore, type Section } from '@/lib/store';
import { cn } from '@/lib/utils';

const QUICK_STEPS: { label: string; section: Section; sub?: string; icon: React.ElementType }[] = [
  { label: 'Dashboard', section: 'dashboard', icon: LayoutDashboard },
  { label: 'Import Masters', section: 'masters', icon: Database },
  { label: 'Coding Practice', section: 'lms', sub: 'quizzes', icon: Code2 },
  { label: 'Reports', section: 'reports', icon: BookOpen },
];

export function DemoBanner() {
  const { currentUser, navigateToSection } = useAppStore();
  const [dismissed, setDismissed] = useState(false);

  const isDemoUser = currentUser && DEMO_ACCOUNTS.some((a) => a.email === currentUser.email);

  const { data: status } = useQuery({
    queryKey: ['demo-status'],
    queryFn: () => fetch('/api/demo/bootstrap').then((r) => r.json()),
    enabled: !!isDemoUser && !dismissed,
    staleTime: 60_000,
  });

  if (!isDemoUser || dismissed) return null;

  return (
    <div className={cn(
      'mb-4 rounded-lg border px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3',
      status?.ready ? 'bg-emerald-50/80 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900' : 'bg-amber-50/80 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900'
    )}>
      <div className="flex items-start gap-2 min-w-0 flex-1">
        <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-brand" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-brand">Demo mode</p>
          <p className="text-[10px] text-muted-foreground">
            {status?.ready
              ? `${status.codingProblems ?? 0} coding problems loaded · use avatar menu to switch roles`
              : 'Data incomplete — open LMS → Coding Practice → Load demo problems'}
          </p>
        </div>
        {status?.ready ? (
          <Badge variant="outline" className="text-[9px] shrink-0 border-emerald-300 text-emerald-700">Ready</Badge>
        ) : (
          <Badge variant="outline" className="text-[9px] shrink-0 border-amber-300 text-amber-700">Setup needed</Badge>
        )}
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        {QUICK_STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <Button
              key={step.section}
              variant="ghost"
              size="sm"
              className="h-7 text-[10px] gap-1 px-2"
              onClick={() => {
                if (step.sub === 'quizzes') {
                  navigateToSection(step.section, { lmsTab: 'quizzes' });
                } else {
                  navigateToSection(step.section);
                }
              }}
            >
              <Icon className="h-3 w-3" />
              {step.label}
              <ChevronRight className="h-2.5 w-2.5 opacity-50" />
            </Button>
          );
        })}
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setDismissed(true)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
