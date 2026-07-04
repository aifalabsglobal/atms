import { db } from '../src/lib/db';

const ODD = { start: '2025-07-01', end: '2025-12-15' };
const EVEN = { start: '2025-12-01', end: '2026-06-30' };

async function countRange(start: string, end: string) {
  return db.calendarEvent.count({
    where: {
      AND: [
        { startDate: { lte: end } },
        {
          OR: [
            { endDate: { gte: start } },
            { AND: [{ endDate: null }, { startDate: { gte: start } }] },
          ],
        },
      ],
    },
  });
}

countRange(ODD.start, ODD.end).then((odd) =>
  countRange(EVEN.start, EVEN.end).then((even) =>
    db.calendarEvent.count().then((total) => {
      console.log({ total, odd, even });
    }),
  ),
).finally(() => db.$disconnect());
