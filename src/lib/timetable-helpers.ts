import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCampusScope, type CampusScope } from '@/lib/auth-helpers';
import type { Role } from '@/lib/store';

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export type TimetableValidationError = { message: string; status: number };

export function toValidationResponse(err: TimetableValidationError) {
  return NextResponse.json({ error: err.message }, { status: err.status });
}

/** UTC-safe day-of-week (0=Sun … 6=Sat) from YYYY-MM-DD. */
export function dayOfWeekFromDate(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00.000Z`).getUTCDay();
}

export function parseSessionDate(dateStr: unknown): TimetableValidationError | null {
  if (typeof dateStr !== 'string' || !DATE_RE.test(dateStr)) {
    return { message: 'sessionDate must be YYYY-MM-DD', status: 400 };
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== m - 1 ||
    probe.getUTCDate() !== d
  ) {
    return { message: 'sessionDate is not a valid calendar date', status: 400 };
  }
  return null;
}

export function parseTimeValue(value: unknown, field: string): TimetableValidationError | null {
  if (typeof value !== 'string' || !TIME_RE.test(value)) {
    return { message: `${field} must be HH:mm (24-hour)`, status: 400 };
  }
  return null;
}

export function parseDayOfWeek(value: unknown): TimetableValidationError | number {
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (!Number.isInteger(n) || n < 0 || n > 6) {
    return { message: 'dayOfWeek must be an integer from 0 (Sunday) to 6 (Saturday)', status: 400 };
  }
  return n;
}

export function parseOptionalDayParam(value: string | null): TimetableValidationError | number | null {
  if (value === null || value === '') return null;
  return parseDayOfWeek(parseInt(value, 10));
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function validateTimeRange(startTime: string, endTime: string): TimetableValidationError | null {
  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    return { message: 'endTime must be after startTime', status: 400 };
  }
  return null;
}

export interface TimetableSlotInput {
  courseId: string;
  semesterId?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  roomNumber?: string | null;
  building?: string | null;
  semester?: string | null;
  academicYear?: string | null;
  isActive?: boolean;
}

export function validateTimetableSlotInput(raw: Record<string, unknown>): TimetableValidationError | TimetableSlotInput {
  const { courseId, semesterId, dayOfWeek, startTime, endTime, roomNumber, building, semester, academicYear, isActive } = raw;

  if (typeof courseId !== 'string' || !courseId) {
    return { message: 'courseId is required', status: 400 };
  }

  const dayResult = parseDayOfWeek(dayOfWeek);
  if (typeof dayResult !== 'number') return dayResult;

  const startErr = parseTimeValue(startTime, 'startTime');
  if (startErr) return startErr;
  const endErr = parseTimeValue(endTime, 'endTime');
  if (endErr) return endErr;
  const rangeErr = validateTimeRange(startTime as string, endTime as string);
  if (rangeErr) return rangeErr;

  return {
    courseId,
    semesterId: semesterId ? String(semesterId) : null,
    dayOfWeek: dayResult,
    startTime: startTime as string,
    endTime: endTime as string,
    roomNumber: roomNumber ? String(roomNumber) : null,
    building: building ? String(building) : null,
    semester: semester ? String(semester) : null,
    academicYear: academicYear ? String(academicYear) : null,
    isActive: isActive === undefined ? true : Boolean(isActive),
  };
}

export function buildTimetableWhere(
  scope: CampusScope,
  filters: {
    courseId?: string | null;
    dayOfWeek?: number | null;
    isActive?: boolean | null;
    semesterId?: string | null;
    academicYear?: string | null;
  } = {},
): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (filters.isActive !== null && filters.isActive !== undefined) {
    where.isActive = filters.isActive;
  } else {
    where.isActive = true;
  }
  if (filters.dayOfWeek !== null && filters.dayOfWeek !== undefined) {
    where.dayOfWeek = filters.dayOfWeek;
  }
  if (filters.semesterId) where.semesterId = filters.semesterId;
  if (filters.academicYear) where.academicYear = filters.academicYear;

  if (scope.level === 'all') {
    if (filters.courseId) where.courseId = filters.courseId;
    return where;
  }

  if (scope.level === 'instructor') {
    const ids = scope.courseIds.length > 0 ? scope.courseIds : ['__none__'];
    if (filters.courseId) {
      where.courseId = scope.courseIds.includes(filters.courseId) ? filters.courseId : '__none__';
    } else {
      where.courseId = { in: ids };
    }
    return where;
  }

  if (scope.level === 'department') {
    where.course = { program: { departmentId: scope.departmentId } };
    if (filters.courseId) where.courseId = filters.courseId;
    return where;
  }

  where.courseId = '__none__';
  return where;
}

export async function getActiveAcademicContext(): Promise<{ semesterId: string | null; academicYear: string | null }> {
  const activeSemester = await db.semester.findFirst({
    where: { status: 'active', isActive: true },
    select: { id: true, academicYear: { select: { name: true } } },
    orderBy: { startDate: 'desc' },
  });
  return {
    semesterId: activeSemester?.id ?? null,
    academicYear: activeSemester?.academicYear?.name ?? null,
  };
}

export async function findOverlappingSlot(
  courseId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  excludeId?: string,
): Promise<TimetableValidationError | null> {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  const existing = await db.timetableSlot.findMany({
    where: {
      courseId,
      dayOfWeek,
      isActive: true,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true, startTime: true, endTime: true },
  });

  for (const slot of existing) {
    const slotStart = timeToMinutes(slot.startTime);
    const slotEnd = timeToMinutes(slot.endTime);
    if (start < slotEnd && end > slotStart) {
      return {
        message: `Overlaps existing slot ${slot.startTime}–${slot.endTime} on ${DAY_LABELS[dayOfWeek]}`,
        status: 409,
      };
    }
  }
  return null;
}

export async function assertTimetableSlotInScope(
  session: { user: { id: string; role: string } },
  slotId: string,
): Promise<{ error: NextResponse | null; slot: Awaited<ReturnType<typeof db.timetableSlot.findUnique>> }> {
  const slot = await db.timetableSlot.findUnique({
    where: { id: slotId },
    include: { course: { select: { id: true, instructorId: true, program: { select: { departmentId: true } } } } },
  });
  if (!slot) {
    return { error: NextResponse.json({ error: 'Timetable slot not found' }, { status: 404 }), slot: null };
  }

  const scope = await getCampusScope(session);
  if (scope.level === 'all') return { error: null, slot };

  if (scope.level === 'instructor') {
    if (!scope.courseIds.includes(slot.courseId)) {
      return { error: NextResponse.json({ error: 'Timetable slot is outside your scope' }, { status: 403 }), slot: null };
    }
    return { error: null, slot };
  }

  if (scope.level === 'department') {
    if (slot.course.program?.departmentId !== scope.departmentId) {
      return { error: NextResponse.json({ error: 'Timetable slot is outside your department' }, { status: 403 }), slot: null };
    }
    return { error: null, slot };
  }

  return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), slot: null };
}

export async function assertCourseInDepartmentForHod(
  session: { user: { id: string; role: string } },
  courseId: string,
): Promise<NextResponse | null> {
  const role = session.user.role as Role;
  if (role !== 'hod') return null;

  const hod = await db.user.findUnique({
    where: { id: session.user.id },
    select: { departmentId: true },
  });
  if (!hod?.departmentId) {
    return NextResponse.json({ error: 'HOD department not configured' }, { status: 403 });
  }

  const course = await db.course.findFirst({
    where: { id: courseId, program: { departmentId: hod.departmentId } },
    select: { id: true },
  });
  if (!course) {
    return NextResponse.json({ error: 'Course is outside your department' }, { status: 403 });
  }
  return null;
}

/** Faculty / lab assistant may only manage timetable slots for courses they instruct. */
export async function assertCourseInstructorForStaff(
  session: { user: { id: string; role: string } },
  courseId: string,
): Promise<NextResponse | null> {
  const role = session.user.role as Role;
  if (role !== 'faculty' && role !== 'lab_assistant') return null;

  const course = await db.course.findFirst({
    where: { id: courseId, instructorId: session.user.id, isActive: true },
    select: { id: true },
  });
  if (!course) {
    return NextResponse.json({ error: 'You can only configure timetable for your assigned courses' }, { status: 403 });
  }
  return null;
}

export async function assertCourseWritableForTimetable(
  session: { user: { id: string; role: string } },
  courseId: string,
): Promise<NextResponse | null> {
  const role = session.user.role as Role;
  if (['super_admin', 'admin'].includes(role)) return null;
  if (role === 'faculty' || role === 'lab_assistant') {
    return assertCourseInstructorForStaff(session, courseId);
  }
  if (role === 'hod') {
    return assertCourseInDepartmentForHod(session, courseId);
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export async function validateSessionTimetableLink(
  courseId: string,
  sessionDate: string,
  timetableSlotId: string | null | undefined,
  startTime?: string | null,
  endTime?: string | null,
): Promise<TimetableValidationError | null> {
  if (!timetableSlotId) return null;

  const dateErr = parseSessionDate(sessionDate);
  if (dateErr) return dateErr;

  const slot = await db.timetableSlot.findUnique({ where: { id: timetableSlotId } });
  if (!slot) {
    return { message: 'Timetable slot not found', status: 400 };
  }
  if (!slot.isActive) {
    return { message: 'Timetable slot is inactive', status: 400 };
  }
  if (slot.courseId !== courseId) {
    return { message: 'Timetable slot does not belong to this course', status: 400 };
  }

  const sessionDay = dayOfWeekFromDate(sessionDate);
  if (slot.dayOfWeek !== sessionDay) {
    return {
      message: `Session date is ${DAY_LABELS[sessionDay]} but slot is scheduled on ${DAY_LABELS[slot.dayOfWeek]}`,
      status: 400,
    };
  }

  if (startTime && startTime !== slot.startTime) {
    return { message: `Start time must match timetable slot (${slot.startTime})`, status: 400 };
  }
  if (endTime && slot.endTime && endTime !== slot.endTime) {
    return { message: `End time must match timetable slot (${slot.endTime})`, status: 400 };
  }

  const duplicate = await db.attendanceSession.findFirst({
    where: {
      timetableSlotId,
      sessionDate,
      status: 'active',
    },
  });
  if (duplicate) {
    return { message: 'An active session already exists for this timetable slot on this date', status: 409 };
  }

  return null;
}
