import { db } from '@/lib/db';
import type { OrgSettings } from './org-defaults';
import { isCampusWorkingDay } from './org-config';

export type AttendanceDayResult = {
  allowed: boolean;
  error?: string;
  holidayTitle?: string;
  compensatory: boolean;
  exam: boolean;
  nonWorking: boolean;
  saturdayOff?: boolean;
};

function eventsOnDateWhere(dateKey: string, types: string[]) {
  return {
    type: { in: types },
    startDate: { lte: dateKey },
    OR: [{ endDate: null }, { endDate: { gte: dateKey } }],
  };
}

/**
 * Whether self-mark attendance should be allowed for a calendar date when
 * holiday / working-day blocking is enabled.
 *
 * Priority:
 * 1. Declared holiday → blocked (unless a compensatory event also covers the day)
 * 2. Exam day + policy `blocked` → blocked
 * 3. Compensatory working day → allowed (even on weekend / Saturday-off)
 * 4. Exam day + policy `optional` → allowed (even on weekend)
 * 5. Non-working day (incl. Saturday off / non-alternate) → blocked
 * 6. Otherwise → allowed
 */
export async function evaluateAttendanceDay(
  dateKey: string,
  org: OrgSettings,
): Promise<AttendanceDayResult> {
  const sessionDay = new Date(`${dateKey}T12:00:00`);
  const working = isCampusWorkingDay(sessionDay, org);
  const nonWorking = !working;
  const saturdayOff = sessionDay.getDay() === 6 && org.saturdayMode === 'off';

  const events = await db.calendarEvent.findMany({
    where: eventsOnDateWhere(dateKey, ['holiday', 'compensatory', 'exam']),
    select: { id: true, title: true, type: true },
    orderBy: { startDate: 'asc' },
  });

  const holiday = events.find((e) => e.type === 'holiday');
  const compensatory = events.some((e) => e.type === 'compensatory');
  const exam = events.find((e) => e.type === 'exam');

  if (holiday && !compensatory) {
    return {
      allowed: false,
      error: `Attendance is blocked on holiday: ${holiday.title}`,
      holidayTitle: holiday.title,
      compensatory: false,
      exam: Boolean(exam),
      nonWorking,
      saturdayOff,
    };
  }

  const examPolicy = org.examDayAttendance;
  if (exam && examPolicy === 'blocked') {
    return {
      allowed: false,
      error: `Attendance is blocked on examination day: ${exam.title}`,
      holidayTitle: holiday?.title,
      compensatory,
      exam: true,
      nonWorking,
      saturdayOff,
    };
  }

  if (compensatory) {
    return {
      allowed: true,
      holidayTitle: holiday?.title,
      compensatory: true,
      exam: Boolean(exam),
      nonWorking,
      saturdayOff,
    };
  }

  if (exam && examPolicy === 'optional') {
    return {
      allowed: true,
      exam: true,
      compensatory: false,
      nonWorking,
      saturdayOff,
    };
  }

  if (nonWorking) {
    const saturdayHint =
      sessionDay.getDay() === 6
        ? org.saturdayMode === 'alternate'
          ? 'Attendance is blocked on this Saturday (alternate weeks only — odd ISO weeks are working).'
          : 'Attendance is blocked on Saturdays (Organization Saturday mode).'
        : 'Attendance is blocked on non-working days (Organization settings).';
    return {
      allowed: false,
      error: saturdayHint,
      compensatory: false,
      exam: Boolean(exam),
      nonWorking: true,
      saturdayOff,
    };
  }

  return {
    allowed: true,
    compensatory: false,
    exam: Boolean(exam),
    nonWorking: false,
    saturdayOff: false,
  };
}
