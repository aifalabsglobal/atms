import { getKnuctConfig } from './config';
import {
  isKnuctCircuitOpen,
  recordKnuctFailure,
  recordKnuctSuccess,
} from './circuit-breaker';
import type { KnuctAdapter, KnuctPrivShare, KnuctWalletResult } from './types';

export class KnuctHttpAdapter implements KnuctAdapter {
  private readonly baseUrl: string;

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
    const res = await this.request<{ did?: string; privshare?: string; privShare?: string }>(
      'POST',
      '/sapi/createwallet',
      {
        body: { passphrase, seedWords },
      }
    );
    const did = res.did;
    const privShareUrl = res.privshare ?? res.privShare;
    if (!did || !privShareUrl) {
      throw new Error('Knuct createwallet response missing did or privshare URL');
    }
    return { did, privShareUrl };
  }

  async fetchPrivateShare(privShareUrl: string): Promise<KnuctPrivShare> {
    const path = privShareUrl.startsWith('http')
      ? new URL(privShareUrl).pathname
      : privShareUrl.startsWith('/')
        ? privShareUrl
        : `/${privShareUrl}`;

    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    const started = Date.now();
    const res = await fetch(url, { method: 'GET', cache: 'no-store' });
    if (!res.ok) {
      recordKnuctFailure();
      throw new Error(`Knuct privshare fetch failed: HTTP ${res.status}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    recordKnuctSuccess();
    console.info('[knuct] privshare fetched', { ms: Date.now() - started, bytes: buf.length });
    return { raw: buf, fetchedAt: new Date() };
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
      const res = await fetch(url, {
        method,
        headers: opts?.body ? { 'Content-Type': 'application/json' } : undefined,
        body: opts?.body ? JSON.stringify(opts.body) : undefined,
        cache: 'no-store',
      });

      const expect = opts?.expectStatus ?? 200;
      if (res.status !== expect && !(expect === 200 && res.ok)) {
        recordKnuctFailure();
        throw new Error(`Knuct ${method} ${path} failed: HTTP ${res.status}`);
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
      recordKnuctFailure();
      throw err;
    }
  }
}
