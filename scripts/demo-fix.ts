/**
 * Idempotent demo data repair — run: npx tsx scripts/demo-fix.ts
 * Ensures coding problems exist and CSE students are enrolled in CS201ES.
 */
import { runDemoBootstrap } from '../src/lib/demo-bootstrap';

async function main() {
  const result = await runDemoBootstrap();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ready) {
    console.error('Demo still not ready — run: npm run db:seed');
    process.exit(1);
  }
  console.log('Demo data OK');
}

main().catch((e) => {
  console.error('demo_fix_failed', e);
  process.exit(1);
});
