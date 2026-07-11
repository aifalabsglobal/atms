'use client';

import { useEffect, useRef } from 'react';
import { signOut } from 'next-auth/react';
import type { GeneralSettings } from '@/lib/settings/general-defaults';
import type { Section } from '@/lib/roles';
import { useAppStore } from '@/lib/store';

/** Landing section, idle logout, and maintenance banner for the authenticated shell. */
export function PlatformSettingsEffects({
  general,
  allowedSections,
  role,
}: {
  general: GeneralSettings;
  allowedSections: Section[];
  role: string;
}) {
  const { setActiveSection } = useAppStore();
  const lastLanding = useRef<string | null>(null);

  useEffect(() => {
    const target = general.landingSection;
    if (!target || target === 'dashboard') {
      lastLanding.current = target || 'dashboard';
      return;
    }
    if (!allowedSections.includes(target)) {
      lastLanding.current = target;
      return;
    }
    // Apply on first load and whenever the campus landing setting changes.
    if (lastLanding.current === target) return;
    lastLanding.current = target;
    setActiveSection(target);
  }, [general.landingSection, allowedSections, setActiveSection]);

  useEffect(() => {
    const minutes = general.sessionTimeoutMinutes;
    if (!minutes || minutes < 15) return;

    const timeoutMs = minutes * 60_000;
    let timer: ReturnType<typeof setTimeout>;

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void signOut({ callbackUrl: '/login' });
      }, timeoutMs);
    };

    const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [general.sessionTimeoutMinutes]);

  const showMaintenance = general.maintenanceMode && role !== 'super_admin' && role !== 'admin';

  if (!showMaintenance) return null;

  return (
    <div className="bg-amber-500 text-amber-950 text-center text-xs sm:text-sm font-medium px-3 py-2">
      Maintenance mode is enabled. Some features may be limited. Contact your administrator.
    </div>
  );
}
