import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const departmentId = searchParams.get('departmentId');
    const semesterId = searchParams.get('semesterId');
    const code = searchParams.get('code');
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const isActive = searchParams.get('isActive');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};
    if (departmentId) where.departmentId = departmentId;
    if (semesterId) where.semesterId = semesterId;
    if (code) where.code = code;
    if (type) where.type = type;
    if (category) where.category = category;
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
      ];
    }

    const [subjects, total] = await Promise.all([
      db.subject.findMany({
        where,
        include: {
          department: { select: { id: true, name: true, code: true } },
          semester: { select: { id: true, name: true, code: true, year: true, semester: true } },
          _count: { select: { courses: true } },
        },
        orderBy: [{ code: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.subject.count({ where }),
    ]);

    return NextResponse.json({ subjects, total, page, limit });
  } catch (error) {
    console.error('Subjects API error:', error);
    return NextResponse.json({ error: 'Failed to load subjects' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      code, name, departmentId, semesterId, credits,
      lectureHours, tutorialHours, labHours, type, category,
      syllabus, textbooks, referenceBooks, isActive,
    } = body;

    if (!code || !name || !departmentId) {
      return NextResponse.json(
        { error: 'Missing required fields: code, name, and departmentId are required' },
        { status: 400 }
      );
    }

    // Check for unique code
    const existing = await db.subject.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ error: 'Subject with this code already exists' }, { status: 409 });
    }

    // Verify department exists
    const department = await db.department.findUnique({ where: { id: departmentId } });
    if (!department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    // Verify semester exists if provided
    if (semesterId) {
      const semester = await db.semester.findUnique({ where: { id: semesterId } });
      if (!semester) {
        return NextResponse.json({ error: 'Semester not found' }, { status: 404 });
      }
    }

    const subject = await db.subject.create({
      data: {
        code,
        name,
        departmentId,
        semesterId: semesterId || null,
        credits: credits || 3,
        lectureHours: lectureHours || 3,
        tutorialHours: tutorialHours || 0,
        labHours: labHours || 0,
        type: type || 'core',
        category,
        syllabus,
        textbooks,
        referenceBooks,
        isActive: isActive !== undefined ? isActive : true,
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
        semester: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json({ subject }, { status: 201 });
  } catch (error) {
    console.error('Create Subject API error:', error);
    return NextResponse.json({ error: 'Failed to create subject' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing required parameter: id' }, { status: 400 });
    }

    const existing = await db.subject.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      code, name, departmentId, semesterId, credits,
      lectureHours, tutorialHours, labHours, type, category,
      syllabus, textbooks, referenceBooks, isActive,
    } = body;

    // Check unique code if being changed
    if (code && code !== existing.code) {
      const duplicate = await db.subject.findUnique({ where: { code } });
      if (duplicate) {
        return NextResponse.json({ error: 'Subject with this code already exists' }, { status: 409 });
      }
    }

    // Verify department exists if being changed
    if (departmentId && departmentId !== existing.departmentId) {
      const department = await db.department.findUnique({ where: { id: departmentId } });
      if (!department) {
        return NextResponse.json({ error: 'Department not found' }, { status: 404 });
      }
    }

    // Verify semester exists if being changed
    if (semesterId !== undefined && semesterId !== existing.semesterId) {
      if (semesterId) {
        const semester = await db.semester.findUnique({ where: { id: semesterId } });
        if (!semester) {
          return NextResponse.json({ error: 'Semester not found' }, { status: 404 });
        }
      }
    }

    const subject = await db.subject.update({
      where: { id },
      data: {
        ...(code !== undefined && { code }),
        ...(name !== undefined && { name }),
        ...(departmentId !== undefined && { departmentId }),
        ...(semesterId !== undefined && { semesterId }),
        ...(credits !== undefined && { credits }),
        ...(lectureHours !== undefined && { lectureHours }),
        ...(tutorialHours !== undefined && { tutorialHours }),
        ...(labHours !== undefined && { labHours }),
        ...(type !== undefined && { type }),
        ...(category !== undefined && { category }),
        ...(syllabus !== undefined && { syllabus }),
        ...(textbooks !== undefined && { textbooks }),
        ...(referenceBooks !== undefined && { referenceBooks }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
        semester: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json({ subject });
  } catch (error) {
    console.error('Update Subject API error:', error);
    return NextResponse.json({ error: 'Failed to update subject' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing required parameter: id' }, { status: 400 });
    }

    const existing = await db.subject.findUnique({
      where: { id },
      include: {
        _count: { select: { courses: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
    }

    // Check for dependent records
    if (existing._count.courses > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete subject. It has ${existing._count.courses} course(s) associated with it. Please remove them first.`,
        },
        { status: 409 }
      );
    }

    await db.subject.delete({ where: { id } });

    return NextResponse.json({ message: 'Subject deleted successfully' });
  } catch (error) {
    console.error('Delete Subject API error:', error);
    return NextResponse.json({ error: 'Failed to delete subject' }, { status: 500 });
  }
}
