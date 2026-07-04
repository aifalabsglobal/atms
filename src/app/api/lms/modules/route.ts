import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireLmsRead, requireLmsWrite, assertInstructorOwnsCourse, auditLms } from '@/lib/lms-helpers';

export async function GET(request: Request) {
  try {
    const { error, session } = await requireLmsRead();
    if (error || !session) return error;

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required' }, { status: 400 });
    }

    const scopeErr = await assertInstructorOwnsCourse(session, courseId);
    if (scopeErr) return scopeErr;

    const modules = await db.module.findMany({
      where: { courseId },
      include: {
        lessons: { orderBy: { orderIndex: 'asc' } },
        _count: { select: { lessons: true } },
      },
      orderBy: { orderIndex: 'asc' },
    });

    return NextResponse.json({ modules, total: modules.length });
  } catch (err) {
    console.error('Modules GET error:', err);
    return NextResponse.json({ error: 'Failed to load modules' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { error, session } = await requireLmsWrite();
    if (error || !session) return error;

    const body = await request.json();
    const { courseId, title, description, orderIndex, isPublished, lessons } = body;

    if (!courseId || !title?.trim()) {
      return NextResponse.json({ error: 'courseId and title are required' }, { status: 400 });
    }

    const scopeErr = await assertInstructorOwnsCourse(session, courseId);
    if (scopeErr) return scopeErr;

    const count = await db.module.count({ where: { courseId } });

    const mod = await db.module.create({
      data: {
        courseId,
        title: title.trim(),
        description: description || null,
        orderIndex: orderIndex ?? count,
        isPublished: isPublished === true,
        lessons: lessons?.length
          ? {
              create: lessons.map((l: { title: string; type?: string; contentUrl?: string; contentBody?: string; duration?: number; orderIndex?: number }, idx: number) => ({
                title: l.title,
                type: l.type || 'video',
                contentUrl: l.contentUrl || null,
                contentBody: l.contentBody || null,
                duration: l.duration ?? null,
                orderIndex: l.orderIndex ?? idx,
                isPublished: true,
              })),
            }
          : undefined,
      },
      include: { lessons: true },
    });

    await auditLms(request, session.user.id, 'lms.module.create', `module:${mod.id}`, { title: mod.title });

    return NextResponse.json({ module: mod }, { status: 201 });
  } catch (err) {
    console.error('Module create error:', err);
    return NextResponse.json({ error: 'Failed to create module' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { error, session } = await requireLmsWrite();
    if (error || !session) return error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const existing = await db.module.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Module not found' }, { status: 404 });

    const scopeErr = await assertInstructorOwnsCourse(session, existing.courseId);
    if (scopeErr) return scopeErr;

    const body = await request.json();
    const { title, description, orderIndex, isPublished } = body;

    const mod = await db.module.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description }),
        ...(orderIndex !== undefined && { orderIndex }),
        ...(isPublished !== undefined && { isPublished }),
      },
      include: { lessons: { orderBy: { orderIndex: 'asc' } } },
    });

    await auditLms(request, session.user.id, 'lms.module.update', `module:${id}`, { title: mod.title });

    return NextResponse.json({ module: mod });
  } catch (err) {
    console.error('Module update error:', err);
    return NextResponse.json({ error: 'Failed to update module' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { error, session } = await requireLmsWrite();
    if (error || !session) return error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const existing = await db.module.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Module not found' }, { status: 404 });

    const scopeErr = await assertInstructorOwnsCourse(session, existing.courseId);
    if (scopeErr) return scopeErr;

    await db.module.delete({ where: { id } });
    await auditLms(request, session.user.id, 'lms.module.delete', `module:${id}`, { title: existing.title });

    return NextResponse.json({ message: 'Module deleted' });
  } catch (err) {
    console.error('Module delete error:', err);
    return NextResponse.json({ error: 'Failed to delete module' }, { status: 500 });
  }
}
