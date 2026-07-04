/**
 * Resolve duplicate active attendance sessions per (timetableSlotId, sessionDate)
 * so the partial unique index can be applied. Keeps the newest session active.
 *
 * Run: npm run db:dedupe-slot-sessions
 */
import { db } from '../src/lib/db';

async function main() {
  const activeLinked = await db.attendanceSession.findMany({
    where: {
      status: 'active',
      timetableSlotId: { not: null },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      timetableSlotId: true,
      sessionDate: true,
      createdAt: true,
      course: { select: { code: true } },
    },
  });

  const groups = new Map<string, typeof activeLinked>();
  for (const session of activeLinked) {
    const key = `${session.timetableSlotId}:${session.sessionDate}`;
    const list = groups.get(key) ?? [];
    list.push(session);
    groups.set(key, list);
  }

  const toComplete: string[] = [];
  for (const [, sessions] of groups) {
    if (sessions.length <= 1) continue;
    const [, ...duplicates] = sessions;
    toComplete.push(...duplicates.map((s) => s.id));
  }

  if (toComplete.length === 0) {
    console.log('No duplicate active slot sessions found.');
    return;
  }

  console.log(`Completing ${toComplete.length} duplicate active session(s)...`);
  for (const id of toComplete) {
    const session = activeLinked.find((s) => s.id === id);
    await db.attendanceSession.update({
      where: { id },
      data: {
        status: 'completed',
        notes: 'Auto-completed: duplicate active session for same timetable slot and date',
      },
    });
    console.log(
      `  → completed ${id} (${session?.course.code ?? '?'} · ${session?.sessionDate})`,
    );
  }

  console.log('Done. Safe to apply AttendanceSession_active_slot_date_key index.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
