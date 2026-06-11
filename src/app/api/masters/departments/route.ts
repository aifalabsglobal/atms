import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search');
    const code = searchParams.get('code');
    const isActive = searchParams.get('isActive');

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
      ];
    }
    if (code) where.code = code;
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    const [departments, total] = await Promise.all([
      db.department.findMany({
        where,
        include: {
          hod: { select: { id: true, name: true, email: true, employeeId: true } },
          _count: { select: { programs: true, subjects: true } },
        },
        orderBy: { code: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.department.count({ where }),
    ]);

    return NextResponse.json({ departments, total, page, limit });
  } catch (error) {
    console.error('Departments API error:', error);
    return NextResponse.json({ error: 'Failed to load departments' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, code, building, floor, phone, email, hodId, isActive } = body;

    if (!name || !code) {
      return NextResponse.json(
        { error: 'Missing required fields: name and code are required' },
        { status: 400 }
      );
    }

    // Check for unique constraints
    const existingName = await db.department.findUnique({ where: { name } });
    if (existingName) {
      return NextResponse.json({ error: 'Department with this name already exists' }, { status: 409 });
    }
    const existingCode = await db.department.findUnique({ where: { code } });
    if (existingCode) {
      return NextResponse.json({ error: 'Department with this code already exists' }, { status: 409 });
    }

    const department = await db.department.create({
      data: {
        name,
        code,
        building,
        floor,
        phone,
        email,
        hodId,
        isActive: isActive !== undefined ? isActive : true,
      },
      include: {
        hod: { select: { id: true, name: true, email: true, employeeId: true } },
      },
    });

    return NextResponse.json({ department }, { status: 201 });
  } catch (error) {
    console.error('Create Department API error:', error);
    return NextResponse.json({ error: 'Failed to create department' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing required parameter: id' }, { status: 400 });
    }

    const existing = await db.department.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, code, building, floor, phone, email, hodId, isActive } = body;

    // Check unique constraints if name/code is being changed
    if (name && name !== existing.name) {
      const existingName = await db.department.findUnique({ where: { name } });
      if (existingName) {
        return NextResponse.json({ error: 'Department with this name already exists' }, { status: 409 });
      }
    }
    if (code && code !== existing.code) {
      const existingCode = await db.department.findUnique({ where: { code } });
      if (existingCode) {
        return NextResponse.json({ error: 'Department with this code already exists' }, { status: 409 });
      }
    }

    const department = await db.department.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(building !== undefined && { building }),
        ...(floor !== undefined && { floor }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(hodId !== undefined && { hodId }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        hod: { select: { id: true, name: true, email: true, employeeId: true } },
      },
    });

    return NextResponse.json({ department });
  } catch (error) {
    console.error('Update Department API error:', error);
    return NextResponse.json({ error: 'Failed to update department' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing required parameter: id' }, { status: 400 });
    }

    const existing = await db.department.findUnique({
      where: { id },
      include: {
        _count: { select: { programs: true, subjects: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    // Check for dependent records
    if (existing._count.programs > 0 || existing._count.subjects > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete department. It has ${existing._count.programs} program(s) and ${existing._count.subjects} subject(s) associated with it. Please remove or reassign them first.`,
        },
        { status: 409 }
      );
    }

    await db.department.delete({ where: { id } });

    return NextResponse.json({ message: 'Department deleted successfully' });
  } catch (error) {
    console.error('Delete Department API error:', error);
    return NextResponse.json({ error: 'Failed to delete department' }, { status: 500 });
  }
}
