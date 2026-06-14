import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAuth, ADMIN_ROLES, requireRoles } from '@/lib/auth-helpers';

export async function GET(request: Request) {
  try {
    const { error } = await requireRoles(ADMIN_ROLES);
    if (error) return error;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const departmentId = searchParams.get('departmentId');
    const code = searchParams.get('code');
    const type = searchParams.get('type');
    const isActive = searchParams.get('isActive');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};
    if (departmentId) where.departmentId = departmentId;
    if (code) where.code = code;
    if (type) where.type = type;
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
      ];
    }

    const [programs, total] = await Promise.all([
      db.program.findMany({
        where,
        include: {
          department: { select: { id: true, name: true, code: true } },
          _count: { select: { courses: true } },
        },
        orderBy: { code: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.program.count({ where }),
    ]);

    return NextResponse.json({ programs, total, page, limit });
  } catch (error) {
    console.error('Programs API error:', error);
    return NextResponse.json({ error: 'Failed to load programs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { error } = await requireRoles(ADMIN_ROLES);
    if (error) return error;

    const body = await request.json();
    const { name, code, departmentId, duration, type, description, isActive } = body;

    if (!name || !code || !departmentId) {
      return NextResponse.json(
        { error: 'Missing required fields: name, code, and departmentId are required' },
        { status: 400 }
      );
    }

    // Check for unique code
    const existing = await db.program.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ error: 'Program with this code already exists' }, { status: 409 });
    }

    // Verify department exists
    const department = await db.department.findUnique({ where: { id: departmentId } });
    if (!department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    const program = await db.program.create({
      data: {
        name,
        code,
        departmentId,
        duration: duration || 4,
        type: type || 'ug',
        description,
        isActive: isActive !== undefined ? isActive : true,
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json({ program }, { status: 201 });
  } catch (error) {
    console.error('Create Program API error:', error);
    return NextResponse.json({ error: 'Failed to create program' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { error } = await requireRoles(ADMIN_ROLES);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing required parameter: id' }, { status: 400 });
    }

    const existing = await db.program.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, code, departmentId, duration, type, description, isActive } = body;

    // Check unique code if being changed
    if (code && code !== existing.code) {
      const duplicate = await db.program.findUnique({ where: { code } });
      if (duplicate) {
        return NextResponse.json({ error: 'Program with this code already exists' }, { status: 409 });
      }
    }

    // Verify department exists if being changed
    if (departmentId && departmentId !== existing.departmentId) {
      const department = await db.department.findUnique({ where: { id: departmentId } });
      if (!department) {
        return NextResponse.json({ error: 'Department not found' }, { status: 404 });
      }
    }

    const program = await db.program.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(departmentId !== undefined && { departmentId }),
        ...(duration !== undefined && { duration }),
        ...(type !== undefined && { type }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json({ program });
  } catch (error) {
    console.error('Update Program API error:', error);
    return NextResponse.json({ error: 'Failed to update program' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { error } = await requireRoles(ADMIN_ROLES);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing required parameter: id' }, { status: 400 });
    }

    const existing = await db.program.findUnique({
      where: { id },
      include: {
        _count: { select: { courses: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    // Check for dependent records
    if (existing._count.courses > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete program. It has ${existing._count.courses} course(s) associated with it. Please remove them first.`,
        },
        { status: 409 }
      );
    }

    await db.program.delete({ where: { id } });

    return NextResponse.json({ message: 'Program deleted successfully' });
  } catch (error) {
    console.error('Delete Program API error:', error);
    return NextResponse.json({ error: 'Failed to delete program' }, { status: 500 });
  }
}
