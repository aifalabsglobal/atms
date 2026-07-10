import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { resolveStudentId, getCampusScope, buildCourseIdFilter, CAMPUS_READ_ROLES } from '@/lib/auth-helpers';
import type { Role } from '@/lib/store';
import { requireLmsRead, requireLmsWrite, assertInstructorOwnsCourse, auditLms } from '@/lib/lms-helpers';
import { getLmsSettings } from '@/lib/settings/lms-config';

export async function GET(request: Request) {
  try {
    const { error, session } = await requireLmsRead();
    if (error || !session) return error;

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const status = searchParams.get('status');
    const { studentId, error: studentError } = await resolveStudentId(session!, searchParams.get('studentId'));
    if (studentError) return studentError;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Build where clause
    const where: Record<string, unknown> = {};
    if (courseId) where.courseId = courseId;
    if (status) where.status = status;

    // If studentId provided, filter to only their enrolled courses
    if (studentId) {
      const enrollments = await db.courseEnrollment.findMany({
        where: { studentId, status: 'enrolled' },
        select: { courseId: true },
      });
      const enrolledCourseIds = enrollments.map(e => e.courseId);
      where.courseId = courseId
        ? (enrolledCourseIds.includes(courseId) ? courseId : '__none__')
        : { in: enrolledCourseIds };
    } else if (CAMPUS_READ_ROLES.includes(session!.user.role as Role)) {
      const scope = await getCampusScope(session!);
      const filter = buildCourseIdFilter(scope, courseId);
      if (filter) where.courseId = filter;
    }

    const [assignments, total] = await Promise.all([
      db.assignment.findMany({
        where,
        include: {
          course: { select: { name: true, code: true } },
          _count: { select: { submissions: true } },
          submissions: {
            select: { id: true, score: true, status: true, studentId: true, feedback: true, submittedAt: true, gradedAt: true },
          },
        },
        orderBy: { dueDate: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.assignment.count({ where }),
    ]);

    // Calculate stats per assignment, and attach student's own submission if studentId
    const assignmentsWithStats = assignments.map(a => {
      const allSubmissions = a.submissions;
      const gradedSubs = allSubmissions.filter(s => s.status === 'graded');
      const avgScore = gradedSubs.length > 0
        ? Math.round(gradedSubs.reduce((s, sub) => s + (sub.score || 0), 0) / gradedSubs.length)
        : null;

      // Find the student's own submission
      const mySubmission = studentId
        ? allSubmissions.find(s => s.studentId === studentId) || null
        : null;

      // Determine student-specific status
      let myStatus: 'not_started' | 'submitted' | 'graded' | 'late' | 'overdue' = 'not_started';
      if (mySubmission) {
        if (mySubmission.status === 'graded') {
          myStatus = 'graded';
        } else if (mySubmission.status === 'submitted' || mySubmission.status === 'late') {
          myStatus = 'submitted';
        }
      } else {
        const now = new Date();
        const dueDate = new Date(a.dueDate);
        if (now > dueDate && a.status !== 'closed') {
          myStatus = 'overdue';
        }
      }

      // Remove full submissions array from response (keep only _count and mySubmission)
      const { submissions: _submissions, ...rest } = a;
      void _submissions;

      return {
        ...rest,
        stats: { totalSubmissions: a._count.submissions, avgScore, gradedCount: gradedSubs.length },
        mySubmission: mySubmission ? {
          id: mySubmission.id,
          score: mySubmission.score,
          status: mySubmission.status,
          feedback: mySubmission.feedback,
          submittedAt: mySubmission.submittedAt,
          gradedAt: mySubmission.gradedAt,
        } : null,
        myStatus,
      };
    });

    return NextResponse.json({ assignments: assignmentsWithStats, total, page, limit });
  } catch (error) {
    console.error('Assignments API error:', error);
    return NextResponse.json({ error: 'Failed to load assignments' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { error, session } = await requireLmsWrite();
    if (error || !session) return error;

    const body = await request.json();
    const { courseId, title, description, maxScore, dueDate, type, allowLate, latePenalty, status } = body;

    if (!courseId || !title || !dueDate) {
      return NextResponse.json({ error: 'courseId, title, and dueDate are required' }, { status: 400 });
    }

    const scopeErr = await assertInstructorOwnsCourse(session, courseId);
    if (scopeErr) return scopeErr;

    const lms = await getLmsSettings();

    const assignment = await db.assignment.create({
      data: {
        courseId,
        title,
        description: description || null,
        maxScore: maxScore ?? lms.defaultAssignmentMaxScore,
        dueDate: new Date(dueDate),
        type: type || 'individual',
        allowLate: allowLate !== undefined ? allowLate !== false : lms.defaultAllowLateSubmissions,
        latePenalty: latePenalty ?? lms.defaultLatePenaltyPct,
        status: status || 'published',
      },
      include: { course: { select: { name: true, code: true } } },
    });

    await auditLms(request, session.user.id, 'lms.assignment.create', `assignment:${assignment.id}`, { title });

    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    console.error('Create assignment error:', error);
    return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { error, session } = await requireLmsWrite();
    if (error || !session) return error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const existing = await db.assignment.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });

    const scopeErr = await assertInstructorOwnsCourse(session, existing.courseId);
    if (scopeErr) return scopeErr;

    const body = await request.json();
    const { title, description, maxScore, dueDate, type, allowLate, latePenalty, status } = body;

    const assignment = await db.assignment.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(maxScore !== undefined && { maxScore }),
        ...(dueDate !== undefined && { dueDate: new Date(dueDate) }),
        ...(type !== undefined && { type }),
        ...(allowLate !== undefined && { allowLate }),
        ...(latePenalty !== undefined && { latePenalty }),
        ...(status !== undefined && { status }),
      },
      include: { course: { select: { name: true, code: true } } },
    });

    await auditLms(request, session.user.id, 'lms.assignment.update', `assignment:${id}`, { title: assignment.title });

    return NextResponse.json({ assignment });
  } catch (error) {
    console.error('Update assignment error:', error);
    return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { error, session } = await requireLmsWrite();
    if (error || !session) return error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const existing = await db.assignment.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });

    const scopeErr = await assertInstructorOwnsCourse(session, existing.courseId);
    if (scopeErr) return scopeErr;

    await db.$transaction([
      db.submission.deleteMany({ where: { assignmentId: id } }),
      db.assignment.delete({ where: { id } }),
    ]);

    await auditLms(request, session.user.id, 'lms.assignment.delete', `assignment:${id}`, { title: existing.title });

    return NextResponse.json({ message: 'Assignment deleted' });
  } catch (error) {
    console.error('Delete assignment error:', error);
    return NextResponse.json({ error: 'Failed to delete assignment' }, { status: 500 });
  }
}
