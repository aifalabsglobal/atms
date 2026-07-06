import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAnySection, getCampusScope } from '@/lib/auth-helpers';
import { rateLimitByUser } from '@/lib/api-rate-limit';
import {
  assertCourseWritableForTimetable,
  assertTimetableSlotInScope,
  buildTimetableWhere,
  findOverlappingSlot,
  parseOptionalDayParam,
  toValidationResponse,
  validateTimetableSlotInput,
} from '@/lib/timetable-helpers';
import type { Role } from '@/lib/store';
import { auditMasterMutation } from '@/lib/masters-helpers';

const TIMETABLE_WRITE_ROLES: Role[] = ['super_admin', 'admin', 'hod', 'faculty', 'lab_assistant'];

async function requireTimetableWrite(session: { user: { id: string; role: string } }) {
  const role = session.user.role as Role;
  if (!TIMETABLE_WRITE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const { error, session } = await requireAnySection(['attendance', 'masters']);
    if (error || !session) return error;

    const scope = await getCampusScope(session);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
    const courseId = searchParams.get('courseId');
    const dayOfWeekParam = searchParams.get('dayOfWeek');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const dayResult = parseOptionalDayParam(dayOfWeekParam);
    if (typeof dayResult === 'object' && dayResult !== null && 'status' in dayResult) {
      return toValidationResponse(dayResult);
    }

    const where = buildTimetableWhere(scope, {
      courseId,
      dayOfWeek: typeof dayResult === 'number' ? dayResult : null,
      isActive: includeInactive ? null : true,
    });

    const [slots, total] = await Promise.all([
      db.timetableSlot.findMany({
        where,
        include: {
          course: { select: { id: true, name: true, code: true } },
          semesterRef: { select: { id: true, name: true, code: true } },
          _count: { select: { attendanceSessions: true } },
        },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.timetableSlot.count({ where }),
    ]);

    return NextResponse.json({ slots, total, page, limit });
  } catch (err) {
    console.error('Timetable slots API error:', err);
    return NextResponse.json({ error: 'Failed to load timetable slots' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { error, session } = await requireAnySection(['attendance', 'masters']);
    if (error || !session) return error;

    const writeError = await requireTimetableWrite(session);
    if (writeError) return writeError;

    const limited = await rateLimitByUser(request, session.user.id, 'timetable-slots-write', 30, 60_000);
    if (limited) return limited;

    const body = await request.json();
    const validated = validateTimetableSlotInput(body);
    if ('status' in validated) return toValidationResponse(validated);

    const scopeError = await assertCourseWritableForTimetable(session, validated.courseId);
    if (scopeError) return scopeError;

    const course = await db.course.findUnique({ where: { id: validated.courseId }, select: { id: true } });
    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    if (validated.semesterId) {
      const semester = await db.semester.findUnique({ where: { id: validated.semesterId }, select: { id: true } });
      if (!semester) {
        return NextResponse.json({ error: 'Semester not found' }, { status: 404 });
      }
    }

    const overlapErr = await findOverlappingSlot(
      validated.courseId,
      validated.dayOfWeek,
      validated.startTime,
      validated.endTime,
    );
    if (overlapErr) return toValidationResponse(overlapErr);

    const slot = await db.timetableSlot.create({
      data: validated,
      include: {
        course: { select: { id: true, name: true, code: true } },
        semesterRef: { select: { id: true, name: true, code: true } },
      },
    });

    await auditMasterMutation(request, session.user.id, 'timetable.create', `slot:${slot.id}`, {
      courseId: validated.courseId,
      dayOfWeek: slot.dayOfWeek,
    });

    return NextResponse.json({ slot }, { status: 201 });
  } catch (err) {
    console.error('Timetable slots API error:', err);
    return NextResponse.json({ error: 'Failed to create timetable slot' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { error, session } = await requireAnySection(['attendance', 'masters']);
    if (error || !session) return error;

    const writeError = await requireTimetableWrite(session);
    if (writeError) return writeError;

    const limited = await rateLimitByUser(request, session.user.id, 'timetable-slots-write', 30, 60_000);
    if (limited) return limited;

    const body = await request.json();
    const { id, ...rest } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error: slotScopeError, slot: existing } = await assertTimetableSlotInScope(session, id);
    if (slotScopeError) return slotScopeError;
    if (!existing) {
      return NextResponse.json({ error: 'Timetable slot not found' }, { status: 404 });
    }

    const merged = {
      courseId: rest.courseId ?? existing.courseId,
      semesterId: rest.semesterId !== undefined ? rest.semesterId : existing.semesterId,
      dayOfWeek: rest.dayOfWeek ?? existing.dayOfWeek,
      startTime: rest.startTime ?? existing.startTime,
      endTime: rest.endTime ?? existing.endTime,
      roomNumber: rest.roomNumber !== undefined ? rest.roomNumber : existing.roomNumber,
      building: rest.building !== undefined ? rest.building : existing.building,
      semester: rest.semester !== undefined ? rest.semester : existing.semester,
      academicYear: rest.academicYear !== undefined ? rest.academicYear : existing.academicYear,
      isActive: rest.isActive !== undefined ? rest.isActive : existing.isActive,
    };

    const validated = validateTimetableSlotInput(merged);
    if ('status' in validated) return toValidationResponse(validated);

    const scopeError = await assertCourseWritableForTimetable(session, validated.courseId);
    if (scopeError) return scopeError;

    if (validated.semesterId) {
      const semester = await db.semester.findUnique({ where: { id: validated.semesterId }, select: { id: true } });
      if (!semester) {
        return NextResponse.json({ error: 'Semester not found' }, { status: 404 });
      }
    }

    const overlapErr = await findOverlappingSlot(
      validated.courseId,
      validated.dayOfWeek,
      validated.startTime,
      validated.endTime,
      id,
    );
    if (overlapErr) return toValidationResponse(overlapErr);

    const slot = await db.timetableSlot.update({
      where: { id },
      data: validated,
      include: {
        course: { select: { id: true, name: true, code: true } },
        semesterRef: { select: { id: true, name: true, code: true } },
      },
    });

    await auditMasterMutation(request, session.user.id, 'timetable.update', `slot:${slot.id}`);

    return NextResponse.json({ slot });
  } catch (err) {
    console.error('Timetable slots API error:', err);
    return NextResponse.json({ error: 'Failed to update timetable slot' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { error, session } = await requireAnySection(['attendance', 'masters']);
    if (error || !session) return error;

    const writeError = await requireTimetableWrite(session);
    if (writeError) return writeError;

    const limited = await rateLimitByUser(request, session.user.id, 'timetable-slots-write', 20, 60_000);
    if (limited) return limited;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error: slotScopeError, slot: existing } = await assertTimetableSlotInScope(session, id);
    if (slotScopeError) return slotScopeError;
    if (!existing) {
      return NextResponse.json({ error: 'Timetable slot not found' }, { status: 404 });
    }

    const existingWithCount = await db.timetableSlot.findUnique({
      where: { id },
      include: { _count: { select: { attendanceSessions: true } } },
    });
    if (!existingWithCount) {
      return NextResponse.json({ error: 'Timetable slot not found' }, { status: 404 });
    }

    const scopeError = await assertCourseWritableForTimetable(session, existingWithCount.courseId);
    if (scopeError) return scopeError;

    if (existingWithCount._count.attendanceSessions > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete slot with attendance history. Set isActive to false instead.',
          sessionCount: existingWithCount._count.attendanceSessions,
        },
        { status: 409 },
      );
    }

    await db.timetableSlot.delete({ where: { id } });

    await auditMasterMutation(request, session.user.id, 'timetable.delete', `slot:${id}`);

    return NextResponse.json({ message: 'Timetable slot deleted' });
  } catch (err) {
    console.error('Timetable slots API error:', err);
    return NextResponse.json({ error: 'Failed to delete timetable slot' }, { status: 500 });
  }
}
