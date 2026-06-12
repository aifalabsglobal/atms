import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const status = searchParams.get('status');
    const studentId = searchParams.get('studentId');
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
