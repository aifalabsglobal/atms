import { randomBytes } from 'crypto';
import type { KnuctAdapter, KnuctPrivShare, KnuctWalletResult } from './types';

/** Deterministic mock adapter for dev/CI when KNUCT_ENABLED=false or circuit is open. */
export class MockKnuctAdapter implements KnuctAdapter {
  async startTempNode(): Promise<void> {
    await delay(10);
  }

  async createWallet(
    _passphrase: string,
    _seedWords: [string, string, string, string]
  ): Promise<KnuctWalletResult> {
    await delay(20);
    const did = `QmMock${randomBytes(16).toString('hex')}`;
    return { did, privShareUrl: `mock://privshare/${did}` };
  }

  async fetchPrivateShare(privShareUrl: string): Promise<KnuctPrivShare> {
    await delay(10);
    return {
      raw: Buffer.from(`mock-privshare:${privShareUrl}:${Date.now()}`, 'utf8'),
      fetchedAt: new Date(),
    };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
