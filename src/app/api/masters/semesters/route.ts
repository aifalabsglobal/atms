import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
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
    const body = await request.json();
    const { academicYearId, name, code, year, semester, startDate, endDate, status, isActive } = body;

    if (!academicYearId || !name || !code || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields: academicYearId, name, code, startDate, and endDate are required' },
        { status: 400 }
      );
    }

    // Check unique constraint on academicYearId + code
    const existing = await db.semester.findFirst({
      where: { academicYearId, code },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Semester with this code already exists for the given academic year' },
        { status: 409 }
      );
    }

    // Verify academic year exists
    const academicYear = await db.academicYear.findUnique({ where: { id: academicYearId } });
    if (!academicYear) {
      return NextResponse.json({ error: 'Academic year not found' }, { status: 404 });
    }

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

    return NextResponse.json({ semester: semesterRecord }, { status: 201 });
  } catch (error) {
    console.error('Create Semester API error:', error);
    return NextResponse.json({ error: 'Failed to create semester' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing required parameter: id' }, { status: 400 });
    }

    const existing = await db.semester.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Semester not found' }, { status: 404 });
    }

    const body = await request.json();
    const { academicYearId, name, code, year, semester, startDate, endDate, status, isActive } = body;

    // If academicYearId or code is being changed, check unique constraint
    const checkAYId = academicYearId || existing.academicYearId;
    const checkCode = code || existing.code;
    if ((academicYearId && academicYearId !== existing.academicYearId) || (code && code !== existing.code)) {
      const duplicate = await db.semester.findFirst({
        where: { academicYearId: checkAYId, code: checkCode, id: { not: id } },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'Semester with this code already exists for the given academic year' },
          { status: 409 }
        );
      }
    }

    // Verify academic year exists if being changed
    if (academicYearId && academicYearId !== existing.academicYearId) {
      const academicYear = await db.academicYear.findUnique({ where: { id: academicYearId } });
      if (!academicYear) {
        return NextResponse.json({ error: 'Academic year not found' }, { status: 404 });
      }
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

    return NextResponse.json({ semester: semesterRecord });
  } catch (error) {
    console.error('Update Semester API error:', error);
    return NextResponse.json({ error: 'Failed to update semester' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing required parameter: id' }, { status: 400 });
    }

    const existing = await db.semester.findUnique({
      where: { id },
      include: {
        _count: { select: { subjects: true, timetableSlots: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Semester not found' }, { status: 404 });
    }

    // Check for dependent records
    if (existing._count.subjects > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete semester. It has ${existing._count.subjects} subject(s) associated with it. Please remove them first.`,
        },
        { status: 409 }
      );
    }

    await db.semester.delete({ where: { id } });

    return NextResponse.json({ message: 'Semester deleted successfully' });
  } catch (error) {
    console.error('Delete Semester API error:', error);
    return NextResponse.json({ error: 'Failed to delete semester' }, { status: 500 });
  }
}
