'use client';

import { useEffect } from 'react';
import { usePlatformSettings } from '@/hooks/use-platform-settings';
import { DEFAULT_GENERAL_SETTINGS } from '@/lib/settings/general-defaults';

/**
 * Applies campus branding globally (login, register, and authenticated shell):
 * document title, favicon, html lang, and --brand-primary CSS variable.
 */
export function CampusBrandingEffects() {
  const { data } = usePlatformSettings(true);
  const general = data ?? DEFAULT_GENERAL_SETTINGS;

  useEffect(() => {
    document.documentElement.style.setProperty('--brand-primary', general.brandingPrimaryColor);
    document.documentElement.lang = general.language || 'en';
  }, [general.brandingPrimaryColor, general.language]);

  useEffect(() => {
    document.title = `${general.appName} - ${general.tagline}`;
  }, [general.appName, general.tagline]);

  useEffect(() => {
    const href = general.faviconUrl || '/logo.jpeg';
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = href;

    let apple = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
    if (!apple) {
      apple = document.createElement('link');
      apple.rel = 'apple-touch-icon';
      document.head.appendChild(apple);
    }
    apple.href = href;
  }, [general.faviconUrl]);

  return null;
}
