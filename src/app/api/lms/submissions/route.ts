import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { resolveStudentId } from '@/lib/auth-helpers';
import { requireLmsRead, requireLmsWrite, assertInstructorOwnsCourse, auditLms } from '@/lib/lms-helpers';
import { enqueueAnchor } from '@/lib/knuct/anchor-service';
import { getLmsSettings } from '@/lib/settings/lms-config';

export async function GET(request: Request) {
  try {
    const { error, session } = await requireLmsRead();
    if (error || !session) return error;

    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get('assignmentId');
    const courseId = searchParams.get('courseId');

    if (!assignmentId && !courseId) {
      return NextResponse.json({ error: 'assignmentId or courseId is required' }, { status: 400 });
    }

    const role = session.user.role;
    if (role === 'student' || role === 'parent') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (assignmentId) {
      const assignment = await db.assignment.findUnique({
        where: { id: assignmentId },
        include: { course: { select: { id: true, code: true, name: true, instructorId: true } } },
      });
      if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });

      const scopeErr = await assertInstructorOwnsCourse(session, assignment.courseId);
      if (scopeErr) return scopeErr;

      const submissions = await db.submission.findMany({
        where: { assignmentId },
        include: {
          student: { select: { id: true, name: true, email: true, employeeId: true } },
        },
        orderBy: { submittedAt: 'desc' },
      });

      return NextResponse.json({
        assignment: {
          id: assignment.id,
          title: assignment.title,
          maxScore: assignment.maxScore,
          course: assignment.course,
        },
        submissions,
        total: submissions.length,
      });
    }

    const scopeErr = await assertInstructorOwnsCourse(session, courseId!);
    if (scopeErr) return scopeErr;

    const submissions = await db.submission.findMany({
      where: { assignment: { courseId: courseId! } },
      include: {
        student: { select: { id: true, name: true, employeeId: true } },
        assignment: { select: { id: true, title: true, maxScore: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    return NextResponse.json({ submissions, total: submissions.length });
  } catch (err) {
    console.error('Submissions GET error:', err);
    return NextResponse.json({ error: 'Failed to load submissions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { error, session } = await requireLmsRead();
    if (error || !session) return error;

    const { studentId, error: studentError } = await resolveStudentId(session, null);
    if (studentError) return studentError;
    if (!studentId || session.user.role !== 'student') {
      return NextResponse.json({ error: 'Only students can submit assignments' }, { status: 403 });
    }

    const body = await request.json();
    const { assignmentId, content } = body;
    if (!assignmentId || !content?.trim()) {
      return NextResponse.json({ error: 'assignmentId and content are required' }, { status: 400 });
    }

    const assignment = await db.assignment.findUnique({
      where: { id: assignmentId },
      include: { course: { select: { id: true } } },
    });
    if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    if (assignment.status === 'draft' || assignment.status === 'closed') {
      return NextResponse.json({ error: 'Assignment is not open for submission' }, { status: 400 });
    }

    const enrolled = await db.courseEnrollment.findUnique({
      where: { courseId_studentId: { courseId: assignment.courseId, studentId } },
    });
    if (!enrolled || enrolled.status !== 'enrolled') {
      return NextResponse.json({ error: 'Not enrolled in this course' }, { status: 403 });
    }

    const now = new Date();
    const isLate = now > assignment.dueDate;
    if (isLate && !assignment.allowLate) {
      return NextResponse.json({ error: 'Late submissions are not allowed' }, { status: 400 });
    }

    const submission = await db.submission.upsert({
      where: { assignmentId_studentId: { assignmentId, studentId } },
      create: {
        assignmentId,
        studentId,
        content: content.trim(),
        status: isLate ? 'late' : 'submitted',
      },
      update: {
        content: content.trim(),
        status: isLate ? 'late' : 'submitted',
        submittedAt: now,
      },
    });

    await auditLms(request, session.user.id, 'lms.submission.create', `submission:${submission.id}`, { assignmentId });

    return NextResponse.json({ submission }, { status: 201 });
  } catch (err) {
    console.error('Submission error:', err);
    return NextResponse.json({ error: 'Failed to submit assignment' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { error, session } = await requireLmsWrite();
    if (error || !session) return error;

    const body = await request.json();
    const { id, score, feedback, status } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const existing = await db.submission.findUnique({
      where: { id },
      include: { assignment: { include: { course: true } } },
    });
    if (!existing) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });

    const role = session.user.role;
    if (role === 'faculty' || role === 'lab_assistant') {
      if (existing.assignment.course.instructorId !== session.user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else if (role !== 'super_admin' && role !== 'admin' && role !== 'hod') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const lms = await getLmsSettings();
    let gradedScore = score !== undefined ? Number(score) : undefined;
    if (
      gradedScore !== undefined &&
      lms.applyLatePenaltyOnGrade &&
      (existing.status === 'late' || existing.status === 'submitted') &&
      existing.submittedAt > existing.assignment.dueDate &&
      typeof existing.assignment.latePenalty === 'number' &&
      existing.assignment.latePenalty > 0
    ) {
      gradedScore = Math.max(
        0,
        Math.round(gradedScore * (1 - existing.assignment.latePenalty / 100) * 100) / 100,
      );
    }

    const submission = await db.submission.update({
      where: { id },
      data: {
        ...(gradedScore !== undefined && { score: gradedScore }),
        ...(feedback !== undefined && { feedback }),
        ...(status !== undefined && { status }),
        ...(gradedScore !== undefined && { status: 'graded', gradedAt: new Date() }),
      },
    });

    if (gradedScore !== undefined) {
      const existingGrade = await db.gradeBook.findFirst({
        where: {
          courseId: existing.assignment.courseId,
          studentId: existing.studentId,
          component: 'assignment',
          componentId: existing.assignmentId,
        },
      });
      if (existingGrade) {
        await db.gradeBook.update({
          where: { id: existingGrade.id },
          data: {
            score: gradedScore,
            maxScore: existing.assignment.maxScore,
            gradedBy: session.user.id,
            gradedAt: new Date(),
          },
        });
        enqueueAnchor('grade_publish', id, {
          courseId: existing.assignment.courseId,
          studentId: existing.studentId,
          component: 'assignment',
          componentId: existing.assignmentId,
          score: gradedScore,
          maxScore: existing.assignment.maxScore,
          gradedBy: session.user.id,
          gradedAt: new Date().toISOString(),
        });
      } else {
        await db.gradeBook.create({
          data: {
            courseId: existing.assignment.courseId,
            studentId: existing.studentId,
            component: 'assignment',
            componentId: existing.assignmentId,
            score: gradedScore,
            maxScore: existing.assignment.maxScore,
            weightage: lms.assignmentGradeWeightPct,
            gradedBy: session.user.id,
          },
        });
        enqueueAnchor('grade_publish', id, {
          courseId: existing.assignment.courseId,
          studentId: existing.studentId,
          component: 'assignment',
          componentId: existing.assignmentId,
          score: gradedScore,
          maxScore: existing.assignment.maxScore,
          gradedBy: session.user.id,
          gradedAt: new Date().toISOString(),
        });
      }
    }

    await auditLms(request, session.user.id, 'lms.submission.grade', `submission:${id}`, {
      score: gradedScore,
    });

    return NextResponse.json({ submission });
  } catch (err) {
    console.error('Grade submission error:', err);
    return NextResponse.json({ error: 'Failed to grade submission' }, { status: 500 });
  }
}
