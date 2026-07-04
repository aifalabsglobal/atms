/**
 * Unit checks for timetable helpers — run: npm run test:timetable
 */
import {
  dayOfWeekFromDate,
  parseDayOfWeek,
  parseSessionDate,
  parseTimeValue,
  timeToMinutes,
  validateTimeRange,
  validateTimetableSlotInput,
} from '../src/lib/timetable-helpers';

type Case = { name: string; run: () => void };

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const cases: Case[] = [
  {
    name: 'dayOfWeekFromDate uses UTC Monday',
    run: () => assert(dayOfWeekFromDate('2026-07-06') === 1, 'expected Monday'),
  },
  {
    name: 'dayOfWeekFromDate uses UTC Saturday',
    run: () => assert(dayOfWeekFromDate('2026-07-04') === 6, 'expected Saturday'),
  },
  {
    name: 'parseSessionDate rejects invalid calendar date',
    run: () => assert(parseSessionDate('2026-02-30') !== null, 'expected invalid date error'),
  },
  {
    name: 'parseSessionDate accepts valid date',
    run: () => assert(parseSessionDate('2026-07-04') === null, 'expected valid date'),
  },
  {
    name: 'parseTimeValue rejects bad format',
    run: () => assert(parseTimeValue('9:00', 'startTime') !== null, 'expected time format error'),
  },
  {
    name: 'validateTimeRange rejects end before start',
    run: () => assert(validateTimeRange('10:00', '09:00') !== null, 'expected range error'),
  },
  {
    name: 'parseDayOfWeek accepts 0-6',
    run: () => assert(parseDayOfWeek(6) === 6, 'expected Saturday index'),
  },
  {
    name: 'parseDayOfWeek rejects 7',
    run: () => assert(typeof parseDayOfWeek(7) === 'object', 'expected validation error'),
  },
  {
    name: 'validateTimetableSlotInput requires courseId',
    run: () => {
      const result = validateTimetableSlotInput({ dayOfWeek: 1, startTime: '09:00', endTime: '10:00' });
      assert('status' in result && result.status === 400, 'expected 400');
    },
  },
  {
    name: 'timeToMinutes converts HH:mm',
    run: () => assert(timeToMinutes('09:30') === 570, 'expected 570 minutes'),
  },
];

let passed = 0;
for (const c of cases) {
  try {
    c.run();
    passed++;
    console.log(`  ✓ ${c.name}`);
  } catch (err) {
    console.error(`  ✗ ${c.name}: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  }
}

console.log(`\n${passed}/${cases.length} timetable helper checks passed`);
if (process.exitCode) process.exit(process.exitCode);
