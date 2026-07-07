/**
 * Reseed academic calendar only (no full DB wipe).
 * Run: npm run seed:calendar
 */
import { db } from '../src/lib/db';
import { CALENDAR_SEED_EVENTS } from '../prisma/calendar-events-data';

function toDbRow(
  event: (typeof CALENDAR_SEED_EVENTS)[number],
  userId: string,
  academicYearId: string,
) {
  return {
    userId,
    academicYearId,
    title: event.title,
    description: event.description ?? null,
    type: event.type,
    startDate: event.startDate,
    endDate: event.endDate ?? null,
    startTime: event.startTime ?? null,
    endTime: event.endTime ?? null,
    location: event.location ?? null,
    color: event.color ?? null,
    isAllDay: !event.startTime,
  };
}

async function main() {
  const superAdmin = await db.user.findFirst({ where: { role: 'super_admin' } });
  const academicYear = await db.academicYear.findFirst({
    where: { isActive: true },
    orderBy: { startDate: 'desc' },
  });

  if (!superAdmin) throw new Error('No super_admin user found — run db:seed first');
  if (!academicYear) throw new Error('No active academic year found — run db:seed first');

  const deleted = await db.calendarEvent.deleteMany({});
  console.log(`Cleared ${deleted.count} existing calendar events`);

  const result = await db.calendarEvent.createMany({
    data: CALENDAR_SEED_EVENTS.map((e) => toDbRow(e, superAdmin.id, academicYear.id)),
  });

  console.log(`Seeded ${result.count} AIMSCS academic calendar events for ${academicYear.name} (${academicYear.regulation})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
