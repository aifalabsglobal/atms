/**
 * Grant Knuct console ops access to a user by email.
 * Usage: npx tsx scripts/grant-knuct-console-access.ts [email]
 */
import { db } from '../src/lib/db';

async function main() {
  const email = (process.argv[2] ?? 'vice.chancellor@aimscs.ac.in').trim().toLowerCase();
  const user = await db.user.update({
    where: { email },
    data: { knuctConsoleAccess: true },
    select: { id: true, email: true, name: true, knuctConsoleAccess: true },
  });
  console.log('Granted knuctConsoleAccess:', user);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => void db.$disconnect());
