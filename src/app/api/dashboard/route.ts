import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const totalStudents = await db.user.count({ where: { role: 'student', status: 'active' } });
    const totalFaculty = await db.user.count({ where: { role: { in: ['faculty', 'hod'] }, status: 'active' } });
    const totalCourses = await db.course.count({ where: { isActive: true } });
    const totalSessions = await db.attendanceSession.count();
    const activeSessions = await db.attendanceSession.count({ where: { status: 'active' } });
    const totalViolations = await db.attendanceViolation.count({ where: { reviewStatus: 'pending' } });
    const totalEnrollments = await db.courseEnrollment.count({ where: { status: 'enrolled' } });

    const completedSessions = await db.attendanceSession.findMany({
      where: { status: 'completed' },
      select: { presentCount: true, absentCount: true, lateCount: true, expectedCount: true },
    });
    const totalPresent = completedSessions.reduce((s, r) => s + r.presentCount, 0);
    const totalAbsent = completedSessions.reduce((s, r) => s + r.absentCount, 0);
    const totalLate = completedSessions.reduce((s, r) => s + r.lateCount, 0);
    const totalExpected = completedSessions.reduce((s, r) => s + r.expectedCount, 0);
    const overallAttendance = totalExpected > 0 ? Math.round((totalPresent / totalExpected) * 100) : 0;

    const courses = await db.course.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true, attendanceSessions: { select: { presentCount: true, expectedCount: true } } },
      take: 8,
    });
    const courseAttendance = courses.map(c => {
      const attended = c.attendanceSessions.reduce((s, a) => s + a.presentCount, 0);
      const expected = c.attendanceSessions.reduce((s, a) => s + a.expectedCount, 0);
      return { id: c.id, name: c.name, code: c.code, attendance: attended, expected, percentage: expected > 0 ? Math.round((attended / expected) * 100) : 0 };
    });

    const sessions = await db.attendanceSession.findMany({ select: { captureMethod: true } });
    const captureMethods: Record<string, number> = {};
    sessions.forEach(s => { captureMethods[s.captureMethod] = (captureMethods[s.captureMethod] || 0) + 1; });

    const recentSessions = await db.attendanceSession.findMany({
      where: { status: 'completed' }, orderBy: { createdAt: 'desc' }, take: 7,
      select: { sessionDate: true, presentCount: true, absentCount: true, lateCount: true },
    });
    const weeklyTrend = recentSessions.reverse().map(s => ({ date: s.sessionDate, present: s.presentCount, absent: s.absentCount, late: s.lateCount }));

    const recentRecords = await db.attendanceRecord.findMany({
      take: 10, orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, captureMethod: true, markedAt: true,
        student: { select: { name: true, department: true } },
        session: { select: { course: { select: { name: true, code: true } }, sessionDate: true } },
      },
    });

    const activeSessionsList = await db.attendanceSession.findMany({
      where: { status: 'active' },
      include: { course: { select: { name: true, code: true } }, creator: { select: { name: true } }, geofence: { select: { name: true } }, timetableSlot: { select: { roomNumber: true, building: true } } },
    });

    const violations = await db.attendanceViolation.findMany({ select: { type: true, severity: true, reviewStatus: true } });
    const violationByType: Record<string, number> = {};
    const violationBySeverity: Record<string, number> = {};
    violations.forEach(v => {
      violationByType[v.type] = (violationByType[v.type] || 0) + 1;
      violationBySeverity[v.severity] = (violationBySeverity[v.severity] || 0) + 1;
    });

    const deptStudentsRaw = await db.user.findMany({
      where: { role: 'student', status: 'active' },
      select: { department: true },
    });
    const deptMap: Record<string, number> = {};
    deptStudentsRaw.forEach(u => { const d = u.department || 'N/A'; deptMap[d] = (deptMap[d] || 0) + 1; });
    const deptAttendance = Object.entries(deptMap).map(([department, students]) => ({ department, students }));

    return NextResponse.json({
      stats: { totalStudents, totalFaculty, totalCourses, totalSessions, activeSessions, pendingViolations: totalViolations, totalEnrollments, overallAttendance, totalPresent, totalAbsent, totalLate },
      courseAttendance, captureMethods, weeklyTrend, recentActivity: recentRecords, activeSessionsList,
      deptAttendance,
      violationByType, violationBySeverity,
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 });
  }
}
