import { db } from '../src/lib/db';
import { enrichAuditLogsWithAnchors } from '../src/lib/knuct/anchor-audit';

async function main() {
  const anchorCount = await db.blockchainAnchor.count();
  const anchors = await db.blockchainAnchor.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: { payloadHash: true, resourceType: true, resourceId: true, createdAt: true },
  });
  console.log('anchor count:', anchorCount);
  console.log('recent anchors:', anchors);

  const logs = await db.auditLog.findMany({
    take: 30,
    orderBy: { createdAt: 'desc' },
    select: { id: true, action: true, resource: true, createdAt: true },
  });
  console.log('\nrecent audit actions:', logs.map((l) => `${l.action} | ${l.resource}`));

  const enriched = await enrichAuditLogsWithAnchors(logs);
  const withHash = enriched.filter((l) => l.anchorHash);
  console.log('\nwith anchorHash:', withHash.length, 'of', enriched.length);
  withHash.forEach((l) => console.log(`  ${l.action} | ${l.resource} | ${l.anchorHash?.slice(0, 16)}...`));
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
