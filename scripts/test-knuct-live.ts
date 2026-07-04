/**
 * Manual contract test against Knuct live sandbox.
 * Run: KNUCT_ENABLED=true npx tsx scripts/test-knuct-live.ts
 * Not included in CI — vendor sandbox may be unstable.
 */
import { createKnuctHttpAdapter } from '../src/lib/knuct/knuct-client';
import { getKnuctConfig } from '../src/lib/knuct/config';
import { KNUCT_SEED_WORDS } from '../src/lib/knuct/types';
import { randomUUID } from 'crypto';

async function main() {
  const config = getKnuctConfig();
  if (!config.enabled) {
    console.log('Skip: set KNUCT_ENABLED=true to run live contract test');
    process.exit(0);
  }

  const adapter = createKnuctHttpAdapter(config.baseUrl);
  const started = Date.now();

  console.log('1/3 startTempNode...');
  await adapter.startTempNode();
  console.log('   ok', Date.now() - started, 'ms');

  const passphrase = randomUUID();
  const seedWords = KNUCT_SEED_WORDS.slice(0, 4).map((w) => w.toLowerCase()) as [string, string, string, string];

  console.log('2/3 createWallet...');
  const { did, privShareUrl } = await adapter.createWallet(passphrase, seedWords);
  console.log('   did', did);
  console.log('   privShareUrl', privShareUrl);

  console.log('3/3 fetchPrivateShare...');
  const share = await adapter.fetchPrivateShare(privShareUrl);
  console.log('   bytes', share.raw.length);

  console.log('Live contract test passed');
}

main().catch((err) => {
  console.error('Live contract test failed:', err);
  process.exit(1);
});
