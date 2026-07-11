import { BRAND } from '@/lib/branding';
import type { Section } from '@/lib/roles';

export type GeneralSettings = {
  appName: string;
  companyName: string;
  tagline: string;
  timezone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  language: string;
  locale: string;
  currency: string;
  paginationDefault: number;
  landingSection: Section;
  brandingPrimaryColor: string;
  logoUrl: string;
  faviconUrl: string;
  copyrightText: string;
  sessionTimeoutMinutes: number;
  maintenanceMode: boolean;
  theme: 'light' | 'dark' | 'system';
};

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  appName: BRAND.name,
  companyName: BRAND.fullOrgName,
  tagline: BRAND.tagline,
  timezone: 'Asia/Kolkata',
  dateFormat: 'dd/MM/yyyy',
  timeFormat: '12h',
  language: 'en',
  locale: 'en-IN',
  currency: 'INR',
  paginationDefault: 20,
  landingSection: 'dashboard',
  brandingPrimaryColor: '#1A3C6E',
  logoUrl: BRAND.logoSrc,
  faviconUrl: BRAND.logoSrc,
  copyrightText: BRAND.copyright,
  sessionTimeoutMinutes: 480,
  maintenanceMode: false,
  theme: 'light',
};
