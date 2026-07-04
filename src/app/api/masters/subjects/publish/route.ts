import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireMastersWrite, auditMasterMutation } from '@/lib/masters-helpers';
import { publishSubjectToLms } from '@/lib/masters-sync';
import { enqueueAnchor } from '@/lib/knuct/anchor-service';

export async function POST(request: Request) {
  try {
    const { error, session } = await requireMastersWrite();
    if (error || !session) return error;

    const body = await request.json();
    const { subjectId, programId, instructorId } = body;

    if (!subjectId || !programId) {
      return NextResponse.json({ error: 'subjectId and programId are required' }, { status: 400 });
    }

    const { course, created } = await publishSubjectToLms(subjectId, programId, instructorId);

    await auditMasterMutation(request, session.user.id, 'masters.subject.publish', `course:${course.id}`, {
      subjectCode: course.code,
    });

    enqueueAnchor('subject_publish', course.id, {
      subjectId,
      programId,
      courseCode: course.code,
      courseName: course.name,
      publishedBy: session.user.id,
      publishedAt: new Date().toISOString(),
      created,
    });

    return NextResponse.json({ course, created }, { status: created ? 201 : 200 });
  } catch (err) {
    console.error('Publish subject error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to publish subject to LMS' },
      { status: 500 }
    );
  }
}
