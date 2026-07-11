'use client';

import { useEffect, useRef } from 'react';
import { signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';
import type { GeneralSettings } from '@/lib/settings/general-defaults';
import type { Section } from '@/lib/roles';
import { useAppStore } from '@/lib/store';

/** Applies branding CSS vars, favicon, html lang, default theme, and idle logout. */
export function PlatformSettingsEffects({
  general,
  allowedSections,
  role,
}: {
  general: GeneralSettings;
  allowedSections: Section[];
  role: string;
}) {
  const { setTheme } = useTheme();
  const { activeSection, setActiveSection } = useAppStore();
  const landingApplied = useRef(false);
  const themeApplied = useRef(false);

  useEffect(() => {
    document.documentElement.style.setProperty('--brand-primary', general.brandingPrimaryColor);
    document.documentElement.lang = general.language || 'en';
  }, [general.brandingPrimaryColor, general.language]);

  useEffect(() => {
    const href = general.faviconUrl || '/logo.jpeg';
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = href;
  }, [general.faviconUrl]);

  useEffect(() => {
    if (themeApplied.current) return;
    themeApplied.current = true;
    if (general.theme === 'light' || general.theme === 'dark' || general.theme === 'system') {
      setTheme(general.theme);
    }
  }, [general.theme, setTheme]);

  useEffect(() => {
    if (landingApplied.current) return;
    const target = general.landingSection;
    if (!target || target === 'dashboard') {
      landingApplied.current = true;
      return;
    }
    if (activeSection !== 'dashboard') {
      landingApplied.current = true;
      return;
    }
    if (allowedSections.includes(target)) {
      setActiveSection(target);
    }
    landingApplied.current = true;
  }, [general.landingSection, allowedSections, activeSection, setActiveSection]);

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
