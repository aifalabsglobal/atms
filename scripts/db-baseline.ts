/**
 * Mark the baseline migration as applied on a DB that was previously synced via `db:push`.
 * Run once: npm run db:baseline
 */
import { execSync } from 'child_process';

const MIGRATION = '20250613000000_init';

console.log(`Marking migration "${MIGRATION}" as applied (baseline)...`);
execSync(`npx prisma migrate resolve --applied ${MIGRATION}`, { stdio: 'inherit' });
console.log('Done. Future schema changes: npm run db:migrate');
