/** Relative public path (`/logo.jpeg`) or absolute http(s) URL. */
const ASSET_URL_RE = /^(https?:\/\/\S+|\/[^\s]+)$/i;

export function isAssetUrl(value: string): boolean {
  return ASSET_URL_RE.test(value);
}

/**
 * Normalize logo/favicon input: trim, prepend `/` for bare filenames,
 * keep absolute http(s) URLs and root-relative paths.
 */
export function normalizeAssetUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let value = raw.trim();
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) return value;

  // Accept "logo.jpeg" or "images/logo.png" as public-folder paths
  if (!value.startsWith('/')) {
    value = `/${value.replace(/^\/+/, '')}`;
  }

  return value.includes(' ') ? null : value;
}

export function resolveAssetUrl(value: string, fallback: string): string {
  const normalized = normalizeAssetUrl(value);
  if (normalized && isAssetUrl(normalized)) return normalized;
  return fallback;
}
