import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { encryptBuffer } from '@/lib/crypto';
import { getKnuctAdapter } from './index';
import { getKnuctConfig } from './config';
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
  const adapter = getKnuctAdapter();

  await db.knuctWallet.upsert({
    where: { userId },
    create: { userId, status: 'pending' },
    update: { status: 'pending', lastError: null },
  });

  let lastErr: unknown;
  const attempts = config.maxRetries + 1;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await adapter.startTempNode();

      const passphrase = randomUUID();
      const seedWords = pickRandomSeedWords(4);
      const { did, privShareUrl } = await adapter.createWallet(passphrase, seedWords);

      const share = await adapter.fetchPrivateShare(privShareUrl);
      const encrypted = encryptBuffer(share.raw);

      await db.knuctWallet.update({
        where: { userId },
        data: {
          did,
          privShareEnc: new Uint8Array(encrypted),
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

/** Non-blocking in-process worker for Phase 1 pilot. */
export function enqueueWalletProvision(userId: string): void {
  enqueueKnuctJob(() => provisionWallet(userId));
}

export function maybeProvisionWalletOnCreate(userId: string): void {
  if (getKnuctConfig().walletOnUserCreate) {
    enqueueWalletProvision(userId);
  }
}
