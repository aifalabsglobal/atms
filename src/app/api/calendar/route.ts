import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAuth, STAFF_ROLES, requireRoles } from '@/lib/auth-helpers';
import type { Role } from '@/lib/store';

const PUBLIC_EVENT_TYPES = ['academic', 'exam', 'holiday', 'event', 'deadline', 'class'];

export async function GET(request: Request) {
  try {
    const { error, session } = await requireAuth();
    if (error || !session) return error;

    const role = session.user.role as Role;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const userId = searchParams.get('userId');
    const type = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const academicYearId = searchParams.get('academicYearId');
    const courseId = searchParams.get('courseId');
    const isAllDay = searchParams.get('isAllDay');

    const where: Record<string, unknown> = {};

    const isStaff = ['super_admin', 'admin', 'hod', 'faculty', 'lab_assistant', 'security'].includes(role);
    if (!isStaff) {
      where.OR = [
        { type: { in: PUBLIC_EVENT_TYPES } },
        { userId: session.user.id },
      ];
    }

    if (userId) {
      if (!isStaff && userId !== session.user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      where.userId = userId;
      delete where.OR;
    }
    if (type) where.type = type;
    if (academicYearId) where.academicYearId = academicYearId;
    if (courseId) where.courseId = courseId;
    if (isAllDay !== null && isAllDay !== undefined && isAllDay !== '') {
      where.isAllDay = isAllDay === 'true';
    }

    if (startDate || endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (startDate) dateFilter.gte = startDate;
      if (endDate) dateFilter.lte = endDate;
      where.startDate = dateFilter;
    }

    const userSelect = isStaff
      ? { id: true, name: true, email: true, role: true }
      : { id: true, name: true };

    const [events, total] = await Promise.all([
      db.calendarEvent.findMany({
        where,
        include: {
          user: { select: userSelect },
          academicYear: { select: { id: true, name: true, code: true, regulation: true } },
        },
        orderBy: { startDate: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.calendarEvent.count({ where }),
    ]);

    return NextResponse.json({ events, total, page, limit });
  } catch (error) {
    console.error('Calendar API error:', error);
    return NextResponse.json({ error: 'Failed to load calendar events' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { error } = await requireRoles(STAFF_ROLES);
    if (error) return error;

    const body = await request.json();
    const {
      userId, title, description, type, startDate, endDate,
      startTime, endTime, location, color, isAllDay,
      courseId, academicYearId,
    } = body;

    if (!userId || !title || !startDate) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, title, and startDate are required' },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (academicYearId) {
      const academicYear = await db.academicYear.findUnique({ where: { id: academicYearId } });
      if (!academicYear) {
        return NextResponse.json({ error: 'Academic year not found' }, { status: 404 });
      }
    }

    const event = await db.calendarEvent.create({
      data: {
        userId,
        title,
        description,
        type: type || 'personal',
        startDate,
        endDate,
        startTime,
        endTime,
        location,
        color,
        isAllDay: isAllDay || false,
        courseId,
        academicYearId,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        academicYear: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    console.error('Create Calendar Event API error:', error);
    return NextResponse.json({ error: 'Failed to create calendar event' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { error } = await requireRoles(STAFF_ROLES);
    if (error) return error;

    const body = await request.json();
    const { id, title, description, type, startDate, endDate,
      startTime, endTime, location, color, isAllDay,
      courseId, academicYearId } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 });
    }

    const existing = await db.calendarEvent.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Calendar event not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (type !== undefined) updateData.type = type;
    if (startDate !== undefined) updateData.startDate = startDate;
    if (endDate !== undefined) updateData.endDate = endDate;
    if (startTime !== undefined) updateData.startTime = startTime;
    if (endTime !== undefined) updateData.endTime = endTime;
    if (location !== undefined) updateData.location = location;
    if (color !== undefined) updateData.color = color;
    if (isAllDay !== undefined) updateData.isAllDay = isAllDay;
    if (courseId !== undefined) updateData.courseId = courseId;
    if (academicYearId !== undefined) updateData.academicYearId = academicYearId;

    const event = await db.calendarEvent.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        academicYear: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json({ event });
  } catch (error) {
    console.error('Update Calendar Event API error:', error);
    return NextResponse.json({ error: 'Failed to update calendar event' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { error } = await requireRoles(STAFF_ROLES);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing required parameter: id' }, { status: 400 });
    }

    const existing = await db.calendarEvent.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Calendar event not found' }, { status: 404 });
    }

    await db.calendarEvent.delete({ where: { id } });

    return NextResponse.json({ message: 'Calendar event deleted successfully' });
  } catch (error) {
    console.error('Delete Calendar Event API error:', error);
    return NextResponse.json({ error: 'Failed to delete calendar event' }, { status: 500 });
  }
}
