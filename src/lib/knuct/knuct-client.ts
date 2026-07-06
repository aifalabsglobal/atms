import { getKnuctConfig } from './config';
import {
  isKnuctCircuitOpen,
  recordKnuctFailure,
  recordKnuctSuccess,
} from './circuit-breaker';
import type { KnuctAdapter, KnuctPrivShare, KnuctWalletData, KnuctWalletResult } from './types';

const DEFAULT_REQUEST_TIMEOUT_MS = Math.max(
  5_000,
  parseInt(process.env.KNUCT_REQUEST_TIMEOUT_MS ?? '45000', 10) || 45_000
);
const PRIVSHARE_TIMEOUT_MS = Math.max(
  DEFAULT_REQUEST_TIMEOUT_MS,
  parseInt(process.env.KNUCT_PRIVSHARE_TIMEOUT_MS ?? '120000', 10) || 120_000
);

/** Vendor doc: GET https://webwallet.knuct.com/sapi/privshare?k=... */
export function resolvePrivShareFetchUrl(privShareUrl: string, baseUrl: string): string {
  if (privShareUrl.startsWith('http')) return privShareUrl;

  let path = privShareUrl.startsWith('/') ? privShareUrl : `/${privShareUrl}`;
  if (path.startsWith('/privshare') && !path.startsWith('/sapi/')) {
    path = `/sapi${path}`;
  } else if (!path.startsWith('/sapi/')) {
    path = `/sapi${path.startsWith('/') ? path : `/${path}`}`;
  }
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

function parseSetCookie(header: string | null, jar: Map<string, string>): void {
  if (!header) return;
  for (const part of header.split(/,(?=\s*[^;,]+=)/)) {
    const [pair] = part.split(';');
    const eq = pair.indexOf('=');
    if (eq > 0) {
      jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
}

export function createKnuctHttpAdapter(baseUrl?: string): KnuctHttpAdapter {
  return new KnuctHttpAdapter(baseUrl);
}

export class KnuctHttpAdapter implements KnuctAdapter {
  private readonly baseUrl: string;
  private readonly cookies = new Map<string, string>();

  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl ?? getKnuctConfig().baseUrl).replace(/\/$/, '');
  }

  async startTempNode(): Promise<void> {
    await this.request('GET', '/sapi/starttempnode', { expectStatus: 204 });
  }

  async createWallet(
    passphrase: string,
    seedWords: [string, string, string, string]
  ): Promise<KnuctWalletResult> {
    const res = await this.request<{
      did?: string;
      privshare?: string;
      privShare?: string;
      data?: { did?: string; privshare?: string; privShare?: string };
    }>('POST', '/sapi/createwallet', {
      body: {
        passphrase,
        seedWords: seedWords.map((w) => w.toLowerCase()),
      },
    });

    const payload = res.data ?? res;
    const did = payload.did;
    const privShareUrl = payload.privshare ?? payload.privShare;
    if (!did || !privShareUrl) {
      throw new Error('Knuct createwallet response missing did or privshare URL');
    }
    return { did, privShareUrl };
  }

  /** Step 1 of DID auth: send hash derived from privshare image, get back challenge string */
  async authChallenge(hash: string): Promise<string> {
    const res = await this.request<{ data?: { challenge?: string }; challenge?: string }>(
      'POST',
      '/sapi/auth/challenge',
      { body: { hash } }
    );
    const challenge = res.data?.challenge ?? (res as { challenge?: string }).challenge;
    if (!challenge) throw new Error('Knuct authChallenge: no challenge in response');
    return challenge;
  }

  /** Step 2 of DID auth: send NLSS-computed binary response array */
  async authResponse(response: number[]): Promise<void> {
    await this.request('POST', '/sapi/auth/response', {
      body: { response },
      expectStatus: 204,
    });
  }

  /** Step 3 of DID auth: start IPFS + blockchain node on Knuct server */
  async startNode(): Promise<void> {
    await this.request('GET', '/sapi/startnode', { expectStatus: 204 });
  }

  /** Step 4 of DID auth: fetch wallet data including the user's DID */
  async walletData(): Promise<KnuctWalletData> {
    const res = await this.request<{ data?: KnuctWalletData } | KnuctWalletData>(
      'GET',
      '/sapi/walletdata'
    );
    const data = (res as { data?: KnuctWalletData }).data ?? (res as KnuctWalletData);
    if (!data?.did) throw new Error('Knuct walletData: no DID in response');
    return data;
  }

  /** Logout from Knuct session */
  async logout(): Promise<void> {
    await this.request('GET', '/sapi/logout', { expectStatus: 200 }).catch(() => {
      // logout errors are non-fatal
    });
    this.cookies.clear();
  }

  async fetchPrivateShare(privShareUrl: string): Promise<KnuctPrivShare> {
    const url = resolvePrivShareFetchUrl(privShareUrl, this.baseUrl);
    const started = Date.now();
    const res = await this.fetchWithSession(url, { method: 'GET' }, PRIVSHARE_TIMEOUT_MS);
    if (!res.ok) {
      recordKnuctFailure();
      const detail = await res.text().catch(() => '');
      throw new Error(`Knuct privshare fetch failed: HTTP ${res.status}${detail ? ` — ${detail.slice(0, 200)}` : ''}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    recordKnuctSuccess();
    console.info('[knuct] privshare fetched', { ms: Date.now() - started, bytes: buf.length });
    return { raw: buf, fetchedAt: new Date() };
  }

  private cookieHeader(): string | undefined {
    if (this.cookies.size === 0) return undefined;
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  private buildHeaders(extra?: Record<string, string>): Headers {
    const config = getKnuctConfig();
    const headers = new Headers({
      Accept: 'application/json',
      ...extra,
    });
    const cookie = this.cookieHeader();
    if (cookie) headers.set('Cookie', cookie);
    if (config.apiKey) headers.set('X-Api-Key', config.apiKey);
    if (config.tenantId) headers.set('X-Tenant-Id', config.tenantId);
    if (config.apiSecret) headers.set('Authorization', `Bearer ${config.apiSecret}`);
    return headers;
  }

  private async fetchWithSession(
    url: string,
    init: RequestInit,
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
  ): Promise<Response> {
    const headers = this.buildHeaders(
      init.headers ? Object.fromEntries(new Headers(init.headers).entries()) : undefined
    );
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...init,
        headers,
        cache: 'no-store',
        signal: controller.signal,
      });
      parseSetCookie(res.headers.get('set-cookie'), this.cookies);
      return res;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Knuct request timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private async request<T>(
    method: string,
    path: string,
    opts?: { body?: unknown; expectStatus?: number }
  ): Promise<T> {
    if (isKnuctCircuitOpen()) {
      throw new Error('Knuct circuit breaker is open');
    }

    const started = Date.now();
    const url = `${this.baseUrl}${path}`;
    try {
      const headers: Record<string, string> = {};
      if (opts?.body) headers['Content-Type'] = 'application/json';

      const res = await this.fetchWithSession(url, {
        method,
        headers,
        body: opts?.body ? JSON.stringify(opts.body) : undefined,
      });

      const expect = opts?.expectStatus ?? 200;
      if (res.status !== expect && !(expect === 200 && res.ok)) {
        recordKnuctFailure();
        const errText = await res.text().catch(() => '');
        let detail = errText.slice(0, 300);
        try {
          const parsed = JSON.parse(errText) as { error?: { detail?: string; title?: string } };
          if (parsed.error?.detail) detail = parsed.error.detail;
          else if (parsed.error?.title) detail = parsed.error.title;
        } catch {
          /* keep raw */
        }
        throw new Error(`Knuct ${method} ${path} failed: HTTP ${res.status} — ${detail}`);
      }

      recordKnuctSuccess();
      console.info('[knuct] api step ok', { method, path, ms: Date.now() - started, status: res.status });

      if (expect === 204 || res.status === 204) {
        return {} as T;
      }

      const text = await res.text();
      if (!text) return {} as T;
      return JSON.parse(text) as T;
    } catch (err) {
      if (!(err instanceof Error && err.message.includes('HTTP'))) {
        recordKnuctFailure();
      }
      throw err;
    }
  }
}
