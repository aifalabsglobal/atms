/**
 * Put demo student Divya into the condonation watch band (~70%)
 * and leave a short note in console. Safe to re-run.
 *
 *   npx tsx scripts/seed-condonation-demo.ts
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  const student = await db.user.findUnique({
    where: { email: 'student.divya@aimscs.ac.in' },
    select: { id: true, name: true, email: true },
  });
  if (!student) {
    throw new Error('Demo student student.divya@aimscs.ac.in not found — run full seed first');
  }

  const records = await db.attendanceRecord.findMany({
    where: { studentId: student.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  if (records.length < 5) {
    throw new Error(
      `Need at least 5 attendance records for ${student.email} (found ${records.length}). Run npm run db:seed first.`,
    );
  }

  // Target ~70% present (watch band: 65–75 with defaults)
  const presentTarget = Math.max(1, Math.floor(records.length * 0.7));
  for (let i = 0; i < records.length; i++) {
    const present = i < presentTarget;
    await db.attendanceRecord.update({
      where: { id: records[i].id },
      data: {
        status: present ? 'present' : 'absent',
        markedAt: present ? new Date() : null,
      },
    });
  }

  const present = presentTarget;
  const total = records.length;
  const pct = Math.round((present / total) * 100);

  // Clear any leftover pending so the form can submit fresh
  await db.condonationRequest.updateMany({
    where: { studentId: student.id, status: 'pending' },
    data: { status: 'withdrawn' },
  });

  console.log(`Condonation demo ready: ${student.name} <${student.email}>`);
  console.log(`  attendance ${present}/${total} = ${pct}% (watch band if 65–74)`);
  console.log('  Login: student.divya@aimscs.ac.in / demo123 → Attendance → Condonation');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
