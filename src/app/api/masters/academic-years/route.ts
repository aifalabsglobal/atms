import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireMastersRead, requireMastersWrite, auditMasterMutation, mastersError, applyAcademicYearDepartmentScope } from '@/lib/masters-helpers';

async function enforceSingleActiveYear(excludeId?: string) {
  await db.academicYear.updateMany({
    where: { status: 'active', ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    data: { status: 'completed' },
  });
}

export async function GET(request: Request) {
  try {
    const { error, session } = await requireMastersRead();
    if (error || !session) return error;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status');
    const regulation = searchParams.get('regulation');
    const isActive = searchParams.get('isActive');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (regulation) where.regulation = regulation;
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    await applyAcademicYearDepartmentScope(session, where);

    const [academicYears, total] = await Promise.all([
      db.academicYear.findMany({
        where,
        include: {
          _count: { select: { semesters: true, calendarEvents: true } },
        },
        orderBy: { startDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.academicYear.count({ where }),
    ]);

    return NextResponse.json({ academicYears, total, page, limit });
  } catch (error) {
    console.error('Academic Years API error:', error);
    return NextResponse.json({ error: 'Failed to load academic years' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { error, session } = await requireMastersWrite();
    if (error || !session) return error;

    const body = await request.json();
    const { name, code, startDate, endDate, status, regulation, isActive } = body;

    if (!name || !code || !startDate || !endDate) {
      return mastersError('Missing required fields: name, code, startDate, and endDate are required');
    }

    const existingName = await db.academicYear.findUnique({ where: { name } });
    if (existingName) return mastersError('Academic year with this name already exists', 409);
    const existingCode = await db.academicYear.findUnique({ where: { code } });
    if (existingCode) return mastersError('Academic year with this code already exists', 409);

    const nextStatus = status || 'upcoming';
    if (nextStatus === 'active') await enforceSingleActiveYear();

    const academicYear = await db.academicYear.create({
      data: {
        name,
        code,
        startDate,
        endDate,
        status: nextStatus,
        regulation,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    await auditMasterMutation(request, session.user.id, 'masters.academic_year.create', `academic_year:${academicYear.id}`, { code });

    return NextResponse.json({ academicYear }, { status: 201 });
  } catch (error) {
    console.error('Create Academic Year API error:', error);
    return NextResponse.json({ error: 'Failed to create academic year' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { error, session } = await requireMastersWrite();
    if (error || !session) return error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return mastersError('Missing required parameter: id');

    const existing = await db.academicYear.findUnique({ where: { id } });
    if (!existing) return mastersError('Academic year not found', 404);

    const body = await request.json();
    const { name, code, startDate, endDate, status, regulation, isActive } = body;

    if (name && name !== existing.name) {
      const existingName = await db.academicYear.findUnique({ where: { name } });
      if (existingName) return mastersError('Academic year with this name already exists', 409);
    }
    if (code && code !== existing.code) {
      const existingCode = await db.academicYear.findUnique({ where: { code } });
      if (existingCode) return mastersError('Academic year with this code already exists', 409);
    }

    if (status === 'active') await enforceSingleActiveYear(id);

    const academicYear = await db.academicYear.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(startDate !== undefined && { startDate }),
        ...(endDate !== undefined && { endDate }),
        ...(status !== undefined && { status }),
        ...(regulation !== undefined && { regulation }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    await auditMasterMutation(request, session.user.id, 'masters.academic_year.update', `academic_year:${id}`, { code: academicYear.code });

    return NextResponse.json({ academicYear });
  } catch (error) {
    console.error('Update Academic Year API error:', error);
    return NextResponse.json({ error: 'Failed to update academic year' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { error, session } = await requireMastersWrite();
    if (error || !session) return error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return mastersError('Missing required parameter: id');

    const existing = await db.academicYear.findUnique({
      where: { id },
      include: { _count: { select: { semesters: true, calendarEvents: true } } },
    });
    if (!existing) return mastersError('Academic year not found', 404);

    if (existing._count.semesters > 0) {
      return mastersError(
        `Cannot delete academic year. It has ${existing._count.semesters} semester(s) associated with it. Please remove them first.`,
        409
      );
    }

    await db.academicYear.delete({ where: { id } });
    await auditMasterMutation(request, session.user.id, 'masters.academic_year.delete', `academic_year:${id}`, { code: existing.code });

    return NextResponse.json({ message: 'Academic year deleted successfully' });
  } catch (error) {
    console.error('Delete Academic Year API error:', error);
    return NextResponse.json({ error: 'Failed to delete academic year' }, { status: 500 });
  }
}
