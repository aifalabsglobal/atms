import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';

    // 1. Attendance Summary Report
    const attendanceSummary = await db.attendanceSession.findMany({
      where: { status: 'completed' },
      include: {
        course: { select: { name: true, code: true } },
        creator: { select: { name: true } },
      },
      orderBy: { sessionDate: 'desc' },
      take: 30,
    });

    // 2. Student Attendance Detail
    const studentAttendance = await db.user.findMany({
      where: { role: 'student', status: 'active' },
      select: {
        id: true, name: true, employeeId: true, department: true,
        _count: { select: { attendanceRecords: true } },
        attendanceRecords: {
          select: { status: true },
        },
      },
      take: 20,
    });
    const studentAttendanceReport = studentAttendance.map(s => {
      const present = s.attendanceRecords.filter(r => r.status === 'present').length;
      const absent = s.attendanceRecords.filter(r => r.status === 'absent').length;
      const late = s.attendanceRecords.filter(r => r.status === 'late').length;
      const total = s.attendanceRecords.length;
      return {
        ...s,
        attendanceRecords: undefined,
        stats: { present, absent, late, total, percentage: total > 0 ? Math.round((present / total) * 100) : 0 },
      };
    });

    // 3. Course Performance Report
    const coursePerformance = await db.course.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, code: true, credits: true, type: true,
        instructor: { select: { name: true } },
        _count: { select: { enrollments: true, assignments: true } },
        gradeBooks: { select: { score: true, maxScore: true, component: true } },
      },
    });
    const coursePerfReport = coursePerformance.map(c => {
      const avgGrade = c.gradeBooks.length > 0
        ? Math.round(c.gradeBooks.reduce((s, g) => s + (g.score / g.maxScore) * 100, 0) / c.gradeBooks.length)
        : null;
      return { ...c, gradeBooks: undefined, avgGrade };
    });

    // 4. Violation Report
    const violationReport = await db.attendanceViolation.findMany({
      include: {
        violator: { select: { name: true, employeeId: true, department: true } },
        record: { select: { session: { select: { sessionDate: true, course: { select: { name: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    // 5. Grade Distribution
    const allGrades = await db.gradeBook.findMany({ select: { score: true, maxScore: true, component: true, studentId: true } });
    const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    allGrades.forEach(g => {
      const pct = (g.score / g.maxScore) * 100;
      if (pct >= 90) gradeDistribution.A++;
      else if (pct >= 75) gradeDistribution.B++;
      else if (pct >= 60) gradeDistribution.C++;
      else if (pct >= 40) gradeDistribution.D++;
      else gradeDistribution.F++;
    });

    return NextResponse.json({
      attendanceSummary,
      studentAttendanceReport,
      coursePerfReport,
      violationReport,
      gradeDistribution,
    });
  } catch (error) {
    console.error('Reports API error:', error);
    return NextResponse.json({ error: 'Failed to load reports' }, { status: 500 });
  }
}
