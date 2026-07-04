import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireLmsWrite, assertInstructorOwnsCourse, auditLms } from '@/lib/lms-helpers';

async function getLessonWithCourse(lessonId: string) {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  });
  return lesson;
}

export async function POST(request: Request) {
  try {
    const { error, session } = await requireLmsWrite();
    if (error || !session) return error;

    const body = await request.json();
    const { moduleId, title, type, contentUrl, contentBody, duration, orderIndex } = body;

    if (!moduleId || !title?.trim()) {
      return NextResponse.json({ error: 'moduleId and title are required' }, { status: 400 });
    }

    const mod = await db.module.findUnique({ where: { id: moduleId } });
    if (!mod) return NextResponse.json({ error: 'Module not found' }, { status: 404 });

    const scopeErr = await assertInstructorOwnsCourse(session, mod.courseId);
    if (scopeErr) return scopeErr;

    const count = await db.lesson.count({ where: { moduleId } });

    const lesson = await db.lesson.create({
      data: {
        moduleId,
        title: title.trim(),
        type: type || 'video',
        contentUrl: contentUrl || null,
        contentBody: contentBody || null,
        duration: duration ?? null,
        orderIndex: orderIndex ?? count,
        isPublished: true,
      },
    });

    await auditLms(request, session.user.id, 'lms.lesson.create', `lesson:${lesson.id}`, { moduleId });

    return NextResponse.json({ lesson }, { status: 201 });
  } catch (err) {
    console.error('Lesson create error:', err);
    return NextResponse.json({ error: 'Failed to create lesson' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { error, session } = await requireLmsWrite();
    if (error || !session) return error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const existing = await getLessonWithCourse(id);
    if (!existing) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });

    const scopeErr = await assertInstructorOwnsCourse(session, existing.module.courseId);
    if (scopeErr) return scopeErr;

    const body = await request.json();
    const { title, type, contentUrl, contentBody, duration, orderIndex, isPublished } = body;

    const lesson = await db.lesson.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(type !== undefined && { type }),
        ...(contentUrl !== undefined && { contentUrl }),
        ...(contentBody !== undefined && { contentBody }),
        ...(duration !== undefined && { duration }),
        ...(orderIndex !== undefined && { orderIndex }),
        ...(isPublished !== undefined && { isPublished }),
      },
    });

    await auditLms(request, session.user.id, 'lms.lesson.update', `lesson:${id}`, { moduleId: existing.moduleId });

    return NextResponse.json({ lesson });
  } catch (err) {
    console.error('Lesson update error:', err);
    return NextResponse.json({ error: 'Failed to update lesson' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { error, session } = await requireLmsWrite();
    if (error || !session) return error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const existing = await getLessonWithCourse(id);
    if (!existing) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });

    const scopeErr = await assertInstructorOwnsCourse(session, existing.module.courseId);
    if (scopeErr) return scopeErr;

    await db.lesson.delete({ where: { id } });
    await auditLms(request, session.user.id, 'lms.lesson.delete', `lesson:${id}`, { moduleId: existing.moduleId });

    return NextResponse.json({ message: 'Lesson deleted' });
  } catch (err) {
    console.error('Lesson delete error:', err);
    return NextResponse.json({ error: 'Failed to delete lesson' }, { status: 500 });
  }
}
