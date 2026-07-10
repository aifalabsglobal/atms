/**
 * One-shot migrate legacy SystemConfig / RbacConfig into SettingValue rows.
 * Usage: npm run settings:migrate
 */
import { migrateLegacySettings } from '../src/lib/settings/migrate-from-legacy';

async function main() {
  console.log('Migrating legacy settings…');
  const result = await migrateLegacySettings('system:cli');
  console.log(`Migrated ${result.migrated.length} keys`);
  result.migrated.forEach((k) => console.log(`  ✓ ${k}`));
  if (result.skipped.length) {
    console.log(`Skipped ${result.skipped.length}:`);
    result.skipped.forEach((k) => console.log(`  · ${k}`));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
