'use client';

import { useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Users, Loader2, Check } from 'lucide-react';
import {
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/lib/demo-accounts';
import { ROLE_LABELS, ROLE_COLORS, useAppStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type RoleSwitcherMenuProps = {
  variant?: 'menu' | 'sidebar';
};

export function RoleSwitcherMenu({ variant = 'menu' }: RoleSwitcherMenuProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { update } = useSession();
  const { toast } = useToast();
  const currentUser = useAppStore((s) => s.currentUser);
  const setActiveSection = useAppStore((s) => s.setActiveSection);
  const setRoleSwitching = useAppStore((s) => s.setRoleSwitching);
  const [switching, setSwitching] = useState<string | null>(null);

  const switchRole = async (email: string, label: string) => {
    if (!currentUser || email === currentUser.email || switching) return;
    setSwitching(email);
    setRoleSwitching(label);
    try {
      const result = await signIn('credentials', {
        email,
        password: DEMO_PASSWORD,
        redirect: false,
      });
      if (result?.error) {
        toast({ title: 'Switch failed', description: 'Could not sign in as that role.', variant: 'destructive' });
        return;
      }
      await update();
      queryClient.clear();
      setActiveSection('dashboard');
      router.refresh();
      toast({ title: `Now viewing as ${label}`, description: ROLE_LABELS[DEMO_ACCOUNTS.find((a) => a.email === email)!.role] });
    } finally {
      setSwitching(null);
      setRoleSwitching(null);
    }
  };

  const items = DEMO_ACCOUNTS.map((account) => {
    const active = currentUser?.email === account.email;
    const loading = switching === account.email;
    const color = ROLE_COLORS[account.role];
    return (
      <DropdownMenuItem
        key={account.email}
        disabled={!!switching}
        onClick={() => switchRole(account.email, account.label)}
        className={cn('gap-2.5', active && 'bg-muted')}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
        ) : (
          <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
        )}
        <span className="flex-1 truncate text-sm">{account.label}</span>
        {active && <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />}
      </DropdownMenuItem>
    );
  });

  if (variant === 'sidebar') {
    return (
      <div className="px-2 pb-2">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-1 mb-1.5">Demo roles</p>
        <div className="flex flex-wrap gap-1">
          {DEMO_ACCOUNTS.map((account) => {
            const active = currentUser?.email === account.email;
            const loading = switching === account.email;
            return (
              <button
                key={account.email}
                type="button"
                disabled={!!switching}
                title={account.label}
                onClick={() => switchRole(account.email, account.label)}
                className={cn(
                  'text-[10px] px-2 py-1 rounded-md border transition-colors truncate max-w-full',
                  active ? 'text-white border-transparent' : 'bg-background hover:bg-muted',
                  loading && 'opacity-60'
                )}
                style={active ? { backgroundColor: ROLE_COLORS[account.role] } : undefined}
              >
                {loading ? '…' : account.label.split(' ')[0]}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2">
        <Users className="h-4 w-4" />
        Switch demo role
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-56">
        {items}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
