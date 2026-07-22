import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { encryptBuffer } from '@/lib/crypto';
import { getKnuctConfig } from './config';
import { isKnuctCircuitOpen } from './circuit-breaker';
import { createKnuctHttpAdapter } from './knuct-client';
import { MockKnuctAdapter } from './mock-adapter';
import { KNUCT_SEED_WORDS, type KnuctSeedWord } from './types';
import { enqueueKnuctJob } from './job-queue';

function pickRandomSeedWords(count: number): [KnuctSeedWord, KnuctSeedWord, KnuctSeedWord, KnuctSeedWord] {
  const pool = [...KNUCT_SEED_WORDS];
  const picked: KnuctSeedWord[] = [];
  while (picked.length < count && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  while (picked.length < 4) {
    picked.push(KNUCT_SEED_WORDS[picked.length % KNUCT_SEED_WORDS.length]);
  }
  return picked as [KnuctSeedWord, KnuctSeedWord, KnuctSeedWord, KnuctSeedWord];
}

export async function provisionWallet(userId: string): Promise<void> {
  const config = getKnuctConfig();
  await db.knuctWallet.upsert({
    where: { userId },
    create: { userId, status: 'pending' },
    update: { status: 'pending', lastError: null },
  });

  let lastErr: unknown;
  const attempts = config.maxRetries + 1;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const { did, privShareEnc } = await createKnuctWalletBundle();
      await db.knuctWallet.update({
        where: { userId },
        data: {
          did,
          privShareEnc: new Uint8Array(privShareEnc),
          status: 'active',
          lastError: null,
        },
      });
      console.info('[knuct] wallet provisioned', { userId, did, mode: config.enabled ? 'live' : 'mock' });
      return;
    } catch (err) {
      lastErr = err;
      console.error('[knuct] wallet provisioning attempt failed', { userId, attempt, err });
      if (attempt < attempts) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
  }

  const message = lastErr instanceof Error ? lastErr.message : 'Unknown error';
  await db.knuctWallet.update({
    where: { userId },
    data: { status: 'failed', lastError: message.slice(0, 500) },
  });
}

/** Create a new Knuct wallet + encrypted privshare (for admin provision or self-registration). */
export async function createKnuctWalletBundle(): Promise<{
  did: string;
  privShareRaw: Buffer;
  privShareEnc: Uint8Array;
}> {
  const config = getKnuctConfig();
  const adapter =
    config.enabled && !isKnuctCircuitOpen()
      ? createKnuctHttpAdapter(config.baseUrl)
      : new MockKnuctAdapter();

  await adapter.startTempNode();
  const passphrase = randomUUID();
  const seedWords = pickRandomSeedWords(4);
  const { did, privShareUrl } = await adapter.createWallet(passphrase, seedWords);
  const share = await adapter.fetchPrivateShare(privShareUrl);
  const encrypted = encryptBuffer(share.raw);

  return {
    did,
    privShareRaw: share.raw,
    privShareEnc: new Uint8Array(encrypted),
  };
}

/** Queue wallet provisioning without blocking the HTTP response (live Knuct can take 1–2 minutes). */
export async function queueWalletProvision(userId: string): Promise<void> {
  await db.knuctWallet.upsert({
    where: { userId },
    create: { userId, status: 'pending' },
    update: { status: 'pending', lastError: null },
  });
  enqueueKnuctJob(() => provisionWallet(userId));
}

/** Non-blocking in-process worker for Phase 1 pilot. */
export function enqueueWalletProvision(userId: string): void {
  void queueWalletProvision(userId).catch((err) => {
    console.error('[knuct] queue wallet provision failed', { userId, err });
  });
}

export function maybeProvisionWalletOnCreate(userId: string): void {
  if (!getKnuctConfig().walletOnUserCreate) return;
  void import('./wallet-provision-request-service')
    .then(async ({ queueWalletProvisionRequestOnUserCreate }) => {
      await queueWalletProvisionRequestOnUserCreate(userId);
    })
    .catch((err) => {
      console.error('[knuct] wallet provision request on user create failed', { userId, err });
    });
}
