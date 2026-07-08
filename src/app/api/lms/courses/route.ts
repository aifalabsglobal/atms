import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { resolveStudentId, getCampusScope, CAMPUS_READ_ROLES } from '@/lib/auth-helpers';
import type { Role } from '@/lib/store';
import { requireLmsRead, requireLmsWrite, auditLms } from '@/lib/lms-helpers';
import { semesterCodeToNumber } from '@/lib/masters-validation';

export async function GET(request: Request) {
  try {
    const { error, session } = await requireLmsRead();
    if (error || !session) return error;

    const role = session.user.role as Role;

    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('programId');
    const type = searchParams.get('type');
    const instructorId = searchParams.get('instructorId');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = { isActive: true };
    if (programId) where.programId = programId;
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
      ];
    }

    if (role === 'student' || role === 'parent') {
      const { studentId, error: studentError } = await resolveStudentId(session, searchParams.get('studentId'));
      if (studentError) return studentError;
      if (!studentId) {
        return NextResponse.json({ courses: [], total: 0, page, limit });
      }
      const enrollments = await db.courseEnrollment.findMany({
        where: { studentId, status: 'enrolled' },
        select: { courseId: true },
      });
      const enrolledIds = enrollments.map((e) => e.courseId);
      where.id = { in: enrolledIds.length > 0 ? enrolledIds : ['__none__'] };
    } else if (role === 'faculty' || role === 'lab_assistant') {
      where.instructorId = instructorId || session.user.id;
    } else if (role === 'hod') {
      const scope = await getCampusScope(session);
      if (scope.level === 'department') {
        where.id = { in: scope.courseIds.length > 0 ? scope.courseIds : ['__none__'] };
      }
    } else if (instructorId) {
      where.instructorId = instructorId;
    }

    const [courses, total] = await Promise.all([
      db.course.findMany({
        where,
        include: {
          program: { select: { name: true, code: true } },
          instructor: { select: { id: true, name: true, email: true } },
          _count: { select: { enrollments: true, modules: true, assignments: true, attendanceSessions: true } },
          modules: { include: { _count: { select: { lessons: true } } }, orderBy: { orderIndex: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.course.count({ where }),
    ]);

    return NextResponse.json({ courses, total, page, limit });
  } catch (error) {
    console.error('Courses API error:', error);
    return NextResponse.json({ error: 'Failed to load courses' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { error, session } = await requireLmsWrite();
    if (error || !session) return error;

    const body = await request.json();
    const { programId, subjectId, code, name, credits, semester, type, description, instructorId, syllabus } = body;

    if (!programId || !code || !name) {
      return NextResponse.json({ error: 'programId, code, and name are required' }, { status: 400 });
    }

    const role = session.user.role as Role;
    const resolvedInstructor =
      role === 'faculty' || role === 'lab_assistant' ? session.user.id : instructorId || null;

    let subjectLink = subjectId as string | undefined;
    let courseCode = String(code).trim().toUpperCase();
    let courseName = name;
    let courseCredits = credits ?? 3;
    let courseSemester = semester ?? 1;
    let courseType = type ?? 'core';
    let courseSyllabus = syllabus;

    if (subjectId) {
      const subject = await db.subject.findUnique({
        where: { id: subjectId },
        include: { semester: { select: { code: true } } },
      });
      if (!subject) return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
      courseCode = subject.code;
      courseName = subject.name;
      courseCredits = subject.credits;
      courseSemester = semesterCodeToNumber(subject.semester?.code);
      courseType = subject.type;
      courseSyllabus = subject.syllabus ?? undefined;
    }

    const dup = await db.course.findUnique({ where: { code: courseCode } });
    if (dup) return NextResponse.json({ error: 'Course code already exists' }, { status: 409 });

    const course = await db.course.create({
      data: {
        programId,
        subjectId: subjectLink || null,
        code: courseCode,
        name: courseName,
        credits: courseCredits,
        semester: courseSemester,
        type: courseType,
        description: description || `${courseName} (AIMSCS R22)`,
        instructorId: resolvedInstructor,
        syllabus: courseSyllabus,
        isActive: true,
      },
      include: {
        program: { select: { name: true, code: true } },
        instructor: { select: { id: true, name: true, email: true } },
      },
    });

    await auditLms(request, session.user.id, 'lms.course.create', `course:${course.id}`, { code: course.code });

    return NextResponse.json({ course }, { status: 201 });
  } catch (error) {
    console.error('Create course error:', error);
    return NextResponse.json({ error: 'Failed to create course' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { error, session } = await requireLmsWrite();
    if (error || !session) return error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const existing = await db.course.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    const role = session.user.role as Role;
    if ((role === 'faculty' || role === 'lab_assistant') && existing.instructorId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const canAssignInstructor = role === 'super_admin' || role === 'admin';
    const course = await db.course.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(canAssignInstructor && body.instructorId !== undefined && {
          instructorId: body.instructorId || null,
        }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.syllabus !== undefined && { syllabus: body.syllabus }),
      },
      include: {
        program: { select: { name: true, code: true } },
        instructor: { select: { id: true, name: true, email: true } },
      },
    });

    await auditLms(request, session.user.id, 'lms.course.update', `course:${id}`, { code: course.code });

    return NextResponse.json({ course });
  } catch (error) {
    console.error('Update course error:', error);
    return NextResponse.json({ error: 'Failed to update course' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { error, session } = await requireLmsWrite();
    if (error || !session) return error;

    const role = session.user.role as Role;
    if (role !== 'super_admin' && role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can delete courses' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const existing = await db.course.findUnique({
      where: { id },
      include: { _count: { select: { enrollments: true } } },
    });
    if (!existing) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

    if (existing._count.enrollments > 0) {
      await db.course.update({ where: { id }, data: { isActive: false } });
      await auditLms(request, session.user.id, 'lms.course.deactivate', `course:${id}`, { code: existing.code });
      return NextResponse.json({ message: 'Course deactivated (has enrollments)', deactivated: true });
    }

    await db.$transaction(async (tx) => {
      const assignmentIds = (await tx.assignment.findMany({ where: { courseId: id }, select: { id: true } })).map((a) => a.id);
      if (assignmentIds.length) {
        await tx.submission.deleteMany({ where: { assignmentId: { in: assignmentIds } } });
        await tx.assignment.deleteMany({ where: { courseId: id } });
      }
      await tx.quizAttempt.deleteMany({ where: { courseId: id } });
      await tx.quizQuestion.deleteMany({ where: { courseId: id } });
      await tx.gradeBook.deleteMany({ where: { courseId: id } });
      await tx.courseEnrollment.deleteMany({ where: { courseId: id } });
      await tx.module.deleteMany({ where: { courseId: id } });
      await tx.attendanceSession.deleteMany({ where: { courseId: id } });
      await tx.timetableSlot.deleteMany({ where: { courseId: id } });
      await tx.course.delete({ where: { id } });
    });

    await auditLms(request, session.user.id, 'lms.course.delete', `course:${id}`, { code: existing.code });

    return NextResponse.json({ message: 'Course deleted', deactivated: false });
  } catch (error) {
    console.error('Delete course error:', error);
    return NextResponse.json({ error: 'Failed to delete course' }, { status: 500 });
  }
}
