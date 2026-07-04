import { db } from '@/lib/db';
import { getKnuctConfig } from '../src/lib/knuct/config';
import { startPilotProvisioning } from '../src/lib/knuct/pilot-service';
import { getKnuctHealth } from '../src/lib/knuct/stats';

async function main() {
  const config = getKnuctConfig();
  if (!config.enabled) {
    console.error('Set KNUCT_ENABLED=true in .env before running the live pilot.');
    process.exit(1);
  }

  const health = await getKnuctHealth();
  console.log('Knuct health:', health);

  const sync = process.argv.includes('--sync');
  console.log(`Starting pilot (${sync ? 'sync' : 'async'}) — cohort limit ${config.pilotCohortLimit}`);

  const result = await startPilotProvisioning({ sync });
  console.log(JSON.stringify(result, null, 2));

  if (sync) {
    const wallets = await db.knuctWallet.findMany({
      where: { userId: { in: result.results.map((r) => r.userId) } },
      select: { userId: true, status: true, did: true, lastError: true },
    });
    console.log('Wallet outcomes:', wallets);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
