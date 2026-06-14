import { db } from '../src/lib/db';

async function main() {
  const count = await db.user.count();
  console.log(`db_ok users=${count}`);
}

main()
  .catch((e) => {
    console.error('db_fail', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
