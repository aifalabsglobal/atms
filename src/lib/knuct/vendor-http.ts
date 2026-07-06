import { getKnuctConfig } from './config';

export type KnuctVendorResponse<T = Record<string, unknown>> = {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
};

/** Shared auth headers for Knuct vendor APIs (chain publish, credential mint, etc.). */
export function knuctVendorHeaders(): Record<string, string> {
  const config = getKnuctConfig();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  if (config.tenantId) headers['X-Knuct-Tenant-Id'] = config.tenantId;
  if (config.apiSecret) headers['X-Knuct-Api-Secret'] = config.apiSecret;
  return headers;
}

export async function knuctVendorPost<T = Record<string, unknown>>(
  url: string,
  body: Record<string, unknown>,
  timeoutMs = 30_000
): Promise<KnuctVendorResponse<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: knuctVendorHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let data: T | undefined;
    try {
      data = text ? (JSON.parse(text) as T) : undefined;
    } catch {
      data = undefined;
    }
    if (!res.ok) {
      const errMsg =
        (data as { error?: string; message?: string } | undefined)?.error ??
        (data as { message?: string } | undefined)?.message ??
        text.slice(0, 200) ??
        res.statusText;
      return { ok: false, status: res.status, data, error: errMsg };
    }
    return { ok: true, status: res.status, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Knuct vendor request failed';
    return { ok: false, status: 0, error: message };
  } finally {
    clearTimeout(timer);
  }
}
