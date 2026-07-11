import { getGlobalBoolean, getGlobalNumber, getGlobalString } from './service';
import type { Section } from '@/lib/roles';
import {
  DEFAULT_GENERAL_SETTINGS,
  type GeneralSettings,
} from './general-defaults';

export type { GeneralSettings };
export { DEFAULT_GENERAL_SETTINGS };

const LANDING_SECTIONS: Section[] = [
  'dashboard',
  'masters',
  'attendance',
  'lms',
  'users',
  'violations',
  'reports',
  'geofences',
  'calendar',
  'settings',
];

function asSection(value: string): Section {
  return (LANDING_SECTIONS.includes(value as Section) ? value : 'dashboard') as Section;
}

function asTimeFormat(value: string): '12h' | '24h' {
  return value === '24h' ? '24h' : '12h';
}

function asTheme(value: string): 'light' | 'dark' | 'system' {
  if (value === 'dark' || value === 'system') return value;
  return 'light';
}

function asAssetPath(value: string, fallback: string): string {
  if (typeof value === 'string' && value.startsWith('/')) return value;
  return fallback;
}

function asHexColor(value: string, fallback: string): string {
  return /^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallback;
}

export async function getGeneralSettings(): Promise<GeneralSettings> {
  const [
    appName,
    companyName,
    tagline,
    timezone,
    dateFormat,
    timeFormat,
    language,
    locale,
    currency,
    paginationDefault,
    landingSection,
    brandingPrimaryColor,
    logoUrl,
    faviconUrl,
    copyrightText,
    sessionTimeoutMinutes,
    maintenanceMode,
    theme,
  ] = await Promise.all([
    getGlobalString('general.app_name', DEFAULT_GENERAL_SETTINGS.appName),
    getGlobalString('general.company_name', DEFAULT_GENERAL_SETTINGS.companyName),
    getGlobalString('general.tagline', DEFAULT_GENERAL_SETTINGS.tagline),
    getGlobalString('general.timezone', DEFAULT_GENERAL_SETTINGS.timezone),
    getGlobalString('general.date_format', DEFAULT_GENERAL_SETTINGS.dateFormat),
    getGlobalString('general.time_format', DEFAULT_GENERAL_SETTINGS.timeFormat),
    getGlobalString('general.language', DEFAULT_GENERAL_SETTINGS.language),
    getGlobalString('general.locale', DEFAULT_GENERAL_SETTINGS.locale),
    getGlobalString('general.currency', DEFAULT_GENERAL_SETTINGS.currency),
    getGlobalNumber('general.pagination_default', DEFAULT_GENERAL_SETTINGS.paginationDefault),
    getGlobalString('general.landing_section', DEFAULT_GENERAL_SETTINGS.landingSection),
    getGlobalString('general.branding_primary_color', DEFAULT_GENERAL_SETTINGS.brandingPrimaryColor),
    getGlobalString('general.logo_url', DEFAULT_GENERAL_SETTINGS.logoUrl),
    getGlobalString('general.favicon_url', DEFAULT_GENERAL_SETTINGS.faviconUrl),
    getGlobalString('general.copyright_text', DEFAULT_GENERAL_SETTINGS.copyrightText),
    getGlobalNumber('general.session_timeout_minutes', DEFAULT_GENERAL_SETTINGS.sessionTimeoutMinutes),
    getGlobalBoolean('general.maintenance_mode', DEFAULT_GENERAL_SETTINGS.maintenanceMode),
    getGlobalString('general.theme', DEFAULT_GENERAL_SETTINGS.theme),
  ]);

  return {
    appName: appName.trim() || DEFAULT_GENERAL_SETTINGS.appName,
    companyName: companyName.trim() || DEFAULT_GENERAL_SETTINGS.companyName,
    tagline: tagline.trim() || DEFAULT_GENERAL_SETTINGS.tagline,
    timezone: timezone.trim() || DEFAULT_GENERAL_SETTINGS.timezone,
    dateFormat: dateFormat.trim() || DEFAULT_GENERAL_SETTINGS.dateFormat,
    timeFormat: asTimeFormat(timeFormat),
    language: language.trim() || DEFAULT_GENERAL_SETTINGS.language,
    locale: locale.trim() || DEFAULT_GENERAL_SETTINGS.locale,
    currency: currency.trim() || DEFAULT_GENERAL_SETTINGS.currency,
    paginationDefault: Math.min(200, Math.max(5, Math.round(paginationDefault) || 20)),
    landingSection: asSection(landingSection),
    brandingPrimaryColor: asHexColor(brandingPrimaryColor, DEFAULT_GENERAL_SETTINGS.brandingPrimaryColor),
    logoUrl: asAssetPath(logoUrl, DEFAULT_GENERAL_SETTINGS.logoUrl),
    faviconUrl: asAssetPath(faviconUrl, DEFAULT_GENERAL_SETTINGS.faviconUrl),
    copyrightText: copyrightText.trim() || DEFAULT_GENERAL_SETTINGS.copyrightText,
    sessionTimeoutMinutes: Math.min(10080, Math.max(15, Math.round(sessionTimeoutMinutes) || 480)),
    maintenanceMode: Boolean(maintenanceMode),
    theme: asTheme(theme),
  };
}
