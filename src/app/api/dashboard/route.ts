import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireSection, resolveStudentId, requireCampusRead, getCampusScope } from '@/lib/auth-helpers';
import type { Role } from '@/lib/store';

async function buildStudentDashboard(studentId: string) {
  const [records, enrollments, enrolledCourseIds] = await Promise.all([
    db.attendanceRecord.findMany({
      where: { studentId },
      include: {
        session: {
          select: {
            sessionDate: true,
            course: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.courseEnrollment.count({ where: { studentId, status: 'enrolled' } }),
    db.courseEnrollment.findMany({
      where: { studentId, status: 'enrolled' },
      select: { courseId: true },
    }),
  ]);

  const courseIds = enrolledCourseIds.map((e) => e.courseId);

  const present = records.filter((r) => r.status === 'present').length;
  const absent = records.filter((r) => r.status === 'absent').length;
  const late = records.filter((r) => r.status === 'late').length;
  const total = records.length;
  const overallAttendance = total > 0 ? Math.round((present / total) * 100) : 0;

  const courseMap = new Map<string, { id: string; name: string; code: string; present: number; total: number }>();
  records.forEach((r) => {
    const c = r.session.course;
    if (!courseMap.has(c.id)) courseMap.set(c.id, { id: c.id, name: c.name, code: c.code, present: 0, total: 0 });
    const entry = courseMap.get(c.id)!;
    entry.total++;
    if (r.status === 'present') entry.present++;
  });

  const courseAttendance = Array.from(courseMap.values()).map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    attendance: c.present,
    expected: c.total,
    percentage: c.total > 0 ? Math.round((c.present / c.total) * 100) : 0,
  }));

  const weeklyTrend = records.slice(0, 7).reverse().map((r) => ({
    date: r.session.sessionDate,
    present: r.status === 'present' ? 1 : 0,
    absent: r.status === 'absent' ? 1 : 0,
    late: r.status === 'late' ? 1 : 0,
  }));

  const recentActivity = records.slice(0, 10).map((r) => ({
    id: r.id,
    status: r.status,
    captureMethod: r.captureMethod,
    markedAt: r.markedAt?.toISOString() ?? r.createdAt.toISOString(),
    student: { name: '', department: '' },
    session: { course: r.session.course, sessionDate: r.session.sessionDate },
  }));

  const activeSessionsList = await db.attendanceSession.findMany({
    where: { status: 'active', courseId: { in: courseIds.length > 0 ? courseIds : ['__none__'] } },
    include: {
      course: { select: { name: true, code: true } },
      creator: { select: { name: true } },
      geofence: { select: { name: true } },
      timetableSlot: { select: { roomNumber: true, building: true } },
    },
  });

  return {
    scope: 'student' as const,
    stats: {
      totalStudents: 0,
      totalFaculty: 0,
      totalCourses: enrollments,
      totalSessions: total,
      activeSessions: activeSessionsList.length,
      pendingViolations: 0,
      totalEnrollments: enrollments,
      overallAttendance,
      totalPresent: present,
      totalAbsent: absent,
      totalLate: late,
    },
    courseAttendance,
    captureMethods: {},
    weeklyTrend,
    recentActivity,
    activeSessionsList,
    deptAttendance: [],
    violationByType: {},
    violationBySeverity: {},
  };
}

export async function GET() {
  try {
    const { error, session } = await requireSection('dashboard');
    if (error || !session) return error;

    const role = session.user.role as Role;

    if (role === 'student' || role === 'parent') {
      const { studentId, error: studentError } = await resolveStudentId(session, null);
      if (studentError) return studentError;
      if (!studentId) {
        return NextResponse.json({ error: 'No student scope available' }, { status: 403 });
      }
      const studentData = await buildStudentDashboard(studentId);
      if (role === 'parent') {
        const ward = await db.user.findUnique({
          where: { id: studentId },
          select: { id: true, name: true, department: true, employeeId: true },
        });
        return NextResponse.json({ ...studentData, scope: 'parent', ward });
      }
      return NextResponse.json(studentData);
    }

    if (role === 'visitor') {
      return NextResponse.json({
        scope: 'visitor',
        stats: { totalStudents: 0, totalFaculty: 0, totalCourses: 0, totalSessions: 0, activeSessions: 0, pendingViolations: 0, totalEnrollments: 0, overallAttendance: 0, totalPresent: 0, totalAbsent: 0, totalLate: 0 },
        courseAttendance: [],
        captureMethods: {},
        weeklyTrend: [],
        recentActivity: [],
        activeSessionsList: [],
        deptAttendance: [],
        violationByType: {},
        violationBySeverity: {},
      });
    }

    const { error: campusError } = await requireCampusRead();
    if (campusError) return campusError;

    const scope = await getCampusScope(session);

    let studentWhere: Record<string, unknown> = { role: 'student', status: 'active' };
    let facultyWhere: Record<string, unknown> = { role: { in: ['faculty', 'hod'] }, status: 'active' };
    let courseWhere: Record<string, unknown> = { isActive: true };
    let sessionWhere: Record<string, unknown> = {};
    let violationWhere: Record<string, unknown> = {};

    if (scope.level === 'instructor') {
      courseWhere = { id: { in: scope.courseIds.length > 0 ? scope.courseIds : ['__none__'] }, isActive: true };
      sessionWhere = { courseId: { in: scope.courseIds.length > 0 ? scope.courseIds : ['__none__'] } };
      const enrollments = await db.courseEnrollment.findMany({
        where: { courseId: { in: scope.courseIds }, status: 'enrolled' },
        select: { studentId: true },
        distinct: ['studentId'],
      });
      const studentIds = enrollments.map((e) => e.studentId);
      studentWhere = { id: { in: studentIds.length > 0 ? studentIds : ['__none__'] }, role: 'student', status: 'active' };
      facultyWhere = { id: session.user.id };
    } else if (scope.level === 'department') {
      courseWhere = { program: { departmentId: scope.departmentId }, isActive: true };
      sessionWhere = { courseId: { in: scope.courseIds.length > 0 ? scope.courseIds : ['__none__'] } };
      studentWhere = { role: 'student', status: 'active', departmentId: scope.departmentId };
      facultyWhere = { role: { in: ['faculty', 'hod'] }, status: 'active', departmentId: scope.departmentId };
      violationWhere = { violator: { departmentId: scope.departmentId } };
    }

    const [
      totalStudents,
      totalFaculty,
      totalCourses,
      totalSessions,
      activeSessions,
      totalViolations,
      totalEnrollments,
      completedSessions,
      courses,
      sessions,
      recentSessions,
      recentRecords,
      activeSessionsList,
      violations,
      deptStudentsRaw,
    ] = await Promise.all([
      db.user.count({ where: studentWhere }),
      db.user.count({ where: facultyWhere }),
      db.course.count({ where: courseWhere }),
      db.attendanceSession.count({ where: sessionWhere }),
      db.attendanceSession.count({ where: { ...sessionWhere, status: 'active' } }),
      db.attendanceViolation.count({ where: { ...violationWhere, reviewStatus: 'pending' } }),
      db.courseEnrollment.count({
        where: scope.level === 'all'
          ? { status: 'enrolled' }
          : { status: 'enrolled', courseId: { in: scope.courseIds.length > 0 ? scope.courseIds : ['__none__'] } },
      }),
      db.attendanceSession.findMany({
        where: { ...sessionWhere, status: 'completed' },
        select: { presentCount: true, absentCount: true, lateCount: true, expectedCount: true },
      }),
      db.course.findMany({
        where: courseWhere,
        select: { id: true, name: true, code: true, attendanceSessions: { select: { presentCount: true, expectedCount: true } } },
        take: 8,
      }),
      db.attendanceSession.findMany({
        where: sessionWhere,
        select: { captureMethod: true },
      }),
      db.attendanceSession.findMany({
        where: { ...sessionWhere, status: 'completed' },
        orderBy: { createdAt: 'desc' },
        take: 7,
        select: { sessionDate: true, presentCount: true, absentCount: true, lateCount: true },
      }),
      db.attendanceRecord.findMany({
        where: scope.level === 'all' ? {} : { session: { courseId: { in: scope.courseIds } } },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, status: true, captureMethod: true, markedAt: true,
          student: { select: { name: true, department: true } },
          session: { select: { course: { select: { name: true, code: true } }, sessionDate: true } },
        },
      }),
      db.attendanceSession.findMany({
        where: { ...sessionWhere, status: 'active' },
        include: {
          course: { select: { name: true, code: true } },
          creator: { select: { name: true } },
          geofence: { select: { name: true } },
          timetableSlot: { select: { roomNumber: true, building: true } },
        },
      }),
      db.attendanceViolation.findMany({
        where: violationWhere,
        select: { type: true, severity: true, reviewStatus: true },
      }),
      scope.level === 'all'
        ? db.user.findMany({
            where: { role: 'student', status: 'active' },
            select: { department: true },
          })
        : Promise.resolve([]),
    ]);

    const totalPresent = completedSessions.reduce((s, r) => s + r.presentCount, 0);
    const totalAbsent = completedSessions.reduce((s, r) => s + r.absentCount, 0);
    const totalLate = completedSessions.reduce((s, r) => s + r.lateCount, 0);
    const totalExpected = completedSessions.reduce((s, r) => s + r.expectedCount, 0);
    const overallAttendance = totalExpected > 0 ? Math.round((totalPresent / totalExpected) * 100) : 0;

    const courseAttendance = courses.map((c) => {
      const attended = c.attendanceSessions.reduce((s, a) => s + a.presentCount, 0);
      const expected = c.attendanceSessions.reduce((s, a) => s + a.expectedCount, 0);
      return { id: c.id, name: c.name, code: c.code, attendance: attended, expected, percentage: expected > 0 ? Math.round((attended / expected) * 100) : 0 };
    });

    const captureMethods: Record<string, number> = {};
    sessions.forEach((s) => { captureMethods[s.captureMethod] = (captureMethods[s.captureMethod] || 0) + 1; });

    const weeklyTrend = recentSessions.reverse().map((s) => ({ date: s.sessionDate, present: s.presentCount, absent: s.absentCount, late: s.lateCount }));

    const violationByType: Record<string, number> = {};
    const violationBySeverity: Record<string, number> = {};
    violations.forEach((v) => {
      violationByType[v.type] = (violationByType[v.type] || 0) + 1;
      violationBySeverity[v.severity] = (violationBySeverity[v.severity] || 0) + 1;
    });

    let deptAttendance: { department: string; students: number }[] = [];
    if (scope.level === 'department') {
      const deptName = await db.department.findUnique({ where: { id: scope.departmentId }, select: { name: true } });
      deptAttendance = [{ department: deptName?.name ?? 'Department', students: totalStudents }];
    } else if (scope.level === 'all') {
      const deptMap: Record<string, number> = {};
      deptStudentsRaw.forEach((u) => { const d = u.department || 'N/A'; deptMap[d] = (deptMap[d] || 0) + 1; });
      deptAttendance = Object.entries(deptMap).map(([department, students]) => ({ department, students }));
    }

    const scopeLabel = scope.level === 'all' ? 'campus' : scope.level === 'department' ? 'department' : 'instructor';

    return NextResponse.json({
      scope: scopeLabel,
      stats: { totalStudents, totalFaculty, totalCourses, totalSessions, activeSessions, pendingViolations: totalViolations, totalEnrollments, overallAttendance, totalPresent, totalAbsent, totalLate },
      courseAttendance, captureMethods, weeklyTrend, recentActivity: recentRecords, activeSessionsList,
      deptAttendance, violationByType, violationBySeverity,
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 });
  }
}
