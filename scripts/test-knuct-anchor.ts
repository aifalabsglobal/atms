import { anchorResource, hashPayload } from '../src/lib/knuct/anchor-service';
import { db } from '../src/lib/db';

async function main() {
  const payload = {
    test: true,
    at: new Date().toISOString(),
  };
  const resourceId = `test-${Date.now()}`;
  const hash = hashPayload({ resourceType: 'attendance_session', resourceId, ...payload });
  console.log('hash', hash.slice(0, 16) + '...');

  const anchor = await anchorResource('attendance_session', resourceId, payload);
  console.log('anchor', anchor);

  const count = await db.blockchainAnchor.count();
  console.log('total anchors', count);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
