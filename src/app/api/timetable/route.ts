import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireCampusRead, getCampusScope } from '@/lib/auth-helpers';
import {
  buildTimetableWhere,
  dayOfWeekFromDate,
  getActiveAcademicContext,
  parseOptionalDayParam,
  parseSessionDate,
  toValidationResponse,
} from '@/lib/timetable-helpers';

export async function GET(request: Request) {
  try {
    const { error, session } = await requireCampusRead();
    if (error || !session) return error;

    const scope = await getCampusScope(session);
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const date = searchParams.get('date');
    const dayParam = searchParams.get('dayOfWeek');
    let semesterId = searchParams.get('semesterId');
    const academicYear = searchParams.get('academicYear');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    if (date) {
      const dateErr = parseSessionDate(date);
      if (dateErr) return toValidationResponse(dateErr);
    }

    const dayParamResult = parseOptionalDayParam(dayParam);
    if (typeof dayParamResult === 'object' && dayParamResult !== null && 'status' in dayParamResult) {
      return toValidationResponse(dayParamResult);
    }

    const dayOfWeek =
      typeof dayParamResult === 'number'
        ? dayParamResult
        : date
          ? dayOfWeekFromDate(date)
          : null;

    if (!semesterId && !academicYear && searchParams.get('allSemesters') !== 'true') {
      const active = await getActiveAcademicContext();
      semesterId = active.semesterId;
    }

    const where = buildTimetableWhere(scope, {
      courseId,
      dayOfWeek,
      semesterId,
      academicYear: academicYear ?? undefined,
      isActive: includeInactive ? null : true,
    });

    const slots = await db.timetableSlot.findMany({
      where,
      include: {
        course: {
          select: {
            id: true,
            name: true,
            code: true,
            instructorId: true,
            _count: { select: { enrollments: true } },
          },
        },
        semesterRef: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    let sessionsBySlot: Record<string, { id: string; status: string; presentCount: number; expectedCount: number }> = {};
    if (date && slots.length > 0) {
      const sessions = await db.attendanceSession.findMany({
        where: {
          sessionDate: date,
          timetableSlotId: { in: slots.map((s) => s.id) },
        },
        select: {
          id: true,
          status: true,
          timetableSlotId: true,
          presentCount: true,
          expectedCount: true,
        },
      });
      sessionsBySlot = Object.fromEntries(
        sessions
          .filter((s) => s.timetableSlotId)
          .map((s) => [s.timetableSlotId!, s]),
      );
    }

    return NextResponse.json({
      date: date ?? null,
      dayOfWeek,
      slots: slots.map((slot) => ({
        id: slot.id,
        courseId: slot.courseId,
        course: {
          id: slot.course.id,
          name: slot.course.name,
          code: slot.course.code,
          enrollmentCount: slot.course._count.enrollments,
        },
        semesterId: slot.semesterId,
        semesterRef: slot.semesterRef,
        semesterLabel: slot.semester,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        roomNumber: slot.roomNumber,
        building: slot.building,
        academicYear: slot.academicYear,
        isActive: slot.isActive,
        session: sessionsBySlot[slot.id] ?? null,
      })),
      total: slots.length,
    });
  } catch (err) {
    console.error('Timetable API error:', err);
    return NextResponse.json({ error: 'Failed to load timetable' }, { status: 500 });
  }
}
