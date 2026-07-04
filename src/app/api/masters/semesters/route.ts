import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireMastersRead, requireMastersWrite, auditMasterMutation, mastersError, applySemesterDepartmentScope } from '@/lib/masters-helpers';

export async function GET(request: Request) {
  try {
    const { error, session } = await requireMastersRead();
    if (error || !session) return error;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const academicYearId = searchParams.get('academicYearId');
    const code = searchParams.get('code');
    const year = searchParams.get('year');
    const semester = searchParams.get('semester');
    const status = searchParams.get('status');
    const isActive = searchParams.get('isActive');

    const where: Record<string, unknown> = {};
    if (academicYearId) where.academicYearId = academicYearId;
    if (code) where.code = code;
    if (year) where.year = parseInt(year);
    if (semester) where.semester = parseInt(semester);
    if (status) where.status = status;
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    await applySemesterDepartmentScope(session, where);

    const [semesters, total] = await Promise.all([
      db.semester.findMany({
        where,
        include: {
          academicYear: { select: { id: true, name: true, code: true, regulation: true } },
          _count: { select: { subjects: true, timetableSlots: true } },
        },
        orderBy: [{ year: 'asc' }, { semester: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.semester.count({ where }),
    ]);

    return NextResponse.json({ semesters, total, page, limit });
  } catch (error) {
    console.error('Semesters API error:', error);
    return NextResponse.json({ error: 'Failed to load semesters' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { error, session } = await requireMastersWrite();
    if (error || !session) return error;

    const body = await request.json();
    const { academicYearId, name, code, year, semester, startDate, endDate, status, isActive } = body;

    if (!academicYearId || !name || !code || !startDate || !endDate) {
      return mastersError('Missing required fields: academicYearId, name, code, startDate, and endDate are required');
    }

    const existing = await db.semester.findFirst({ where: { academicYearId, code } });
    if (existing) return mastersError('Semester with this code already exists for the given academic year', 409);

    const academicYear = await db.academicYear.findUnique({ where: { id: academicYearId } });
    if (!academicYear) return mastersError('Academic year not found', 404);

    const semesterRecord = await db.semester.create({
      data: {
        academicYearId,
        name,
        code,
        year: year || 1,
        semester: semester || 1,
        startDate,
        endDate,
        status: status || 'upcoming',
        isActive: isActive !== undefined ? isActive : true,
      },
      include: {
        academicYear: { select: { id: true, name: true, code: true, regulation: true } },
      },
    });

    await auditMasterMutation(request, session.user.id, 'masters.semester.create', `semester:${semesterRecord.id}`, { code });

    return NextResponse.json({ semester: semesterRecord }, { status: 201 });
  } catch (error) {
    console.error('Create Semester API error:', error);
    return NextResponse.json({ error: 'Failed to create semester' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { error, session } = await requireMastersWrite();
    if (error || !session) return error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return mastersError('Missing required parameter: id');

    const existing = await db.semester.findUnique({ where: { id } });
    if (!existing) return mastersError('Semester not found', 404);

    const body = await request.json();
    const { academicYearId, name, code, year, semester, startDate, endDate, status, isActive } = body;

    const checkAYId = academicYearId || existing.academicYearId;
    const checkCode = code || existing.code;
    if ((academicYearId && academicYearId !== existing.academicYearId) || (code && code !== existing.code)) {
      const duplicate = await db.semester.findFirst({
        where: { academicYearId: checkAYId, code: checkCode, id: { not: id } },
      });
      if (duplicate) return mastersError('Semester with this code already exists for the given academic year', 409);
    }

    if (academicYearId && academicYearId !== existing.academicYearId) {
      const academicYear = await db.academicYear.findUnique({ where: { id: academicYearId } });
      if (!academicYear) return mastersError('Academic year not found', 404);
    }

    const semesterRecord = await db.semester.update({
      where: { id },
      data: {
        ...(academicYearId !== undefined && { academicYearId }),
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(year !== undefined && { year }),
        ...(semester !== undefined && { semester }),
        ...(startDate !== undefined && { startDate }),
        ...(endDate !== undefined && { endDate }),
        ...(status !== undefined && { status }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        academicYear: { select: { id: true, name: true, code: true, regulation: true } },
      },
    });

    await auditMasterMutation(request, session.user.id, 'masters.semester.update', `semester:${id}`, { code: semesterRecord.code });

    return NextResponse.json({ semester: semesterRecord });
  } catch (error) {
    console.error('Update Semester API error:', error);
    return NextResponse.json({ error: 'Failed to update semester' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { error, session } = await requireMastersWrite();
    if (error || !session) return error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return mastersError('Missing required parameter: id');

    const existing = await db.semester.findUnique({
      where: { id },
      include: { _count: { select: { subjects: true, timetableSlots: true } } },
    });
    if (!existing) return mastersError('Semester not found', 404);

    if (existing._count.subjects > 0) {
      return mastersError(
        `Cannot delete semester. It has ${existing._count.subjects} subject(s) associated with it. Please remove them first.`,
        409
      );
    }

    await db.semester.delete({ where: { id } });
    await auditMasterMutation(request, session.user.id, 'masters.semester.delete', `semester:${id}`, { code: existing.code });

    return NextResponse.json({ message: 'Semester deleted successfully' });
  } catch (error) {
    console.error('Delete Semester API error:', error);
    return NextResponse.json({ error: 'Failed to delete semester' }, { status: 500 });
  }
}
