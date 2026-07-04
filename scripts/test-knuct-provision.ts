import { provisionWallet } from '../src/lib/knuct/wallet-service';
import { db } from '../src/lib/db';

async function main() {
  const u = await db.user.findFirst({
    where: { role: 'super_admin' },
    select: { id: true, email: true },
  });
  if (!u) throw new Error('no super admin');
  console.log('Provisioning for', u.email);
  await provisionWallet(u.id);
  const w = await db.knuctWallet.findUnique({ where: { userId: u.id } });
  console.log(JSON.stringify({ status: w?.status, did: w?.did }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
