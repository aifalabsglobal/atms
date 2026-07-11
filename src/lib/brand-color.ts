/** Fallback when CSS var / platform settings are unavailable (SSR charts). */
export const DEFAULT_BRAND_PRIMARY = '#1A3C6E';

/** Live brand accent from document CSS (set by CampusBrandingEffects). */
export function readBrandPrimary(): string {
  if (typeof document === 'undefined') return DEFAULT_BRAND_PRIMARY;
  const v = getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim();
  return /^#[0-9A-Fa-f]{6}$/.test(v) ? v : DEFAULT_BRAND_PRIMARY;
}
