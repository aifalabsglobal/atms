/**
 * Manual E2E contract test against Knuct live sandbox.
 * Run: KNUCT_ENABLED=true npx tsx scripts/test-knuct-live.ts
 *
 * Validates vendor checklist:
 *   wallet create (starttempnode) → privshare → DID auth (startnode) → getAccountInfo
 */
import { createKnuctHttpAdapter } from '../src/lib/knuct/knuct-client';
import { getKnuctConfig } from '../src/lib/knuct/config';
import { KNUCT_SEED_WORDS } from '../src/lib/knuct/types';
import { computePrivShareHashFromBuffer } from '../src/lib/knuct/priv-share-server';
import { createChallengeResponse } from '../src/lib/knuct/nlss';
import { randomUUID } from 'crypto';

async function main() {
  const config = getKnuctConfig();
  if (!config.enabled) {
    console.log('Skip: set KNUCT_ENABLED=true to run live contract test');
    process.exit(0);
  }

  const adapter = createKnuctHttpAdapter(config.baseUrl);
  const started = Date.now();

  console.log('1/7 startTempNode (wallet creation)...');
  await adapter.startTempNode();
  console.log('   ok', Date.now() - started, 'ms');

  const passphrase = randomUUID();
  const seedWords = KNUCT_SEED_WORDS.slice(0, 4).map((w) => w.toLowerCase()) as [
    string, string, string, string,
  ];

  console.log('2/7 createWallet...');
  const { did: createdDid, privShareUrl } = await adapter.createWallet(passphrase, seedWords);
  console.log('   did', createdDid);
  console.log('   privShareUrl', privShareUrl);

  console.log('3/7 fetchPrivateShare...');
  const share = await adapter.fetchPrivateShare(privShareUrl);
  console.log('   bytes', share.raw.length);

  // Fresh adapter for auth flow (separate session from wallet creation)
  const authAdapter = createKnuctHttpAdapter(config.baseUrl);

  console.log('4/7 compute privshare hash (server-side sharp, same as browser Canvas)...');
  const { privShare, hash } = await computePrivShareHashFromBuffer(share.raw);
  console.log('   hash prefix', hash.slice(0, 12), '…');
  console.log('   privShare bytes', privShare.length);

  console.log('5/7 authChallenge...');
  const challenge = await authAdapter.authChallenge(hash);
  console.log('   challenge', challenge.slice(0, 16), '…');

  console.log('6/7 authResponse + startNode + walletData...');
  const response = createChallengeResponse(challenge, 32, privShare);
  await authAdapter.authResponse(response);
  await authAdapter.startNode();
  const walletData = await authAdapter.walletData();
  console.log('   authenticated did', walletData.did);

  if (walletData.did !== createdDid) {
    console.warn('   warning: walletData.did differs from createWallet did');
  }

  console.log('7/7 capi/getAccountInfo...');
  let accountInfo: unknown;
  try {
    accountInfo = await authAdapter.capiGetAccountInfo();
    console.log('   accountInfo', JSON.stringify(accountInfo).slice(0, 200));
  } catch (err) {
    console.warn('   getAccountInfo failed (CAPI may need /capi/start first):', err);
    try {
      await authAdapter.capiStart();
      accountInfo = await authAdapter.capiGetAccountInfo();
      console.log('   accountInfo after capi/start', JSON.stringify(accountInfo).slice(0, 200));
    } catch (err2) {
      console.error('   getAccountInfo still failed:', err2);
      process.exit(1);
    }
  }

  console.log('\nLive E2E contract test passed');
}

main().catch((err) => {
  console.error('Live contract test failed:', err);
  process.exit(1);
});
