import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireSection, resolveStudentId, getCampusScope } from '@/lib/auth-helpers';
import type { Role } from '@/lib/store';
import {
  attendanceRiskStatus,
  buildDepartmentAnalytics,
  buildStudentAttendanceStats,
  buildWeeklyTrend,
  getDepartmentName,
  scopeLabel,
} from '@/lib/reports-analytics';
import { getKnuctDashboardStats } from '@/lib/knuct';
import { getAttendanceThresholds } from '@/lib/system-config';

async function buildStudentDashboard(studentId: string, thresholds: Awaited<ReturnType<typeof getAttendanceThresholds>>) {
  const [present, absent, late, total, enrollments, records, activeSessionsList] = await Promise.all([
    db.attendanceRecord.count({ where: { studentId, status: 'present' } }),
    db.attendanceRecord.count({ where: { studentId, status: 'absent' } }),
    db.attendanceRecord.count({ where: { studentId, status: 'late' } }),
    db.attendanceRecord.count({ where: { studentId } }),
    db.courseEnrollment.count({ where: { studentId, status: 'enrolled' } }),
    db.attendanceRecord.findMany({
      where: { studentId },
      take: 40,
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
    db.attendanceSession.findMany({
      where: {
        status: 'active',
        course: { enrollments: { some: { studentId, status: 'enrolled' } } },
      },
      take: 10,
      include: {
        course: { select: { name: true, code: true } },
        creator: { select: { name: true } },
        geofence: { select: { name: true } },
        timetableSlot: { select: { roomNumber: true, building: true } },
      },
    }),
  ]);

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

  const weeklyRateTrend = buildWeeklyTrend(
    records.map((r) => ({
      sessionDate: r.session.sessionDate,
      presentCount: r.status === 'present' ? 1 : 0,
      absentCount: r.status === 'absent' ? 1 : 0,
      lateCount: r.status === 'late' ? 1 : 0,
      expectedCount: 1,
    }))
  );

  const weeklyTrend = weeklyRateTrend.map((w) => ({
    date: w.week,
    present: w.present,
    absent: w.absent,
    late: w.late,
    rate: w.rate,
  }));

  const recentActivity = records.slice(0, 10).map((r) => ({
    id: r.id,
    status: r.status,
    captureMethod: r.captureMethod,
    markedAt: r.markedAt?.toISOString() ?? r.createdAt.toISOString(),
    student: { name: '', department: '' },
    session: { course: r.session.course, sessionDate: r.session.sessionDate },
  }));

  return {
    scope: 'student' as const,
    thresholds,
    riskStatus: attendanceRiskStatus(overallAttendance, total, thresholds),
    weeklyRateTrend,
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
      const thresholds = await getAttendanceThresholds();
      const { studentId, error: studentError } = await resolveStudentId(session, null);
      if (studentError) return studentError;
      if (!studentId) {
        return NextResponse.json({ error: 'No student scope available' }, { status: 403 });
      }
      const studentData = await buildStudentDashboard(studentId, thresholds);
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

    const scope = await getCampusScope(session);
    const thresholds = await getAttendanceThresholds();

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

    const deptName = scope.level === 'department' ? await getDepartmentName(scope.departmentId) : undefined;
    const { scope: analyticsScope, label: scopeLabelText } = scopeLabel(scope, deptName);

    const courseFilter = scope.level === 'all' ? undefined : { in: scope.courseIds.length > 0 ? scope.courseIds : ['__none__'] };

    const [
      totalStudents,
      totalFaculty,
      totalCourses,
      totalSessions,
      activeSessions,
      totalViolations,
      totalEnrollments,
      completedAgg,
      courses,
      captureMethodGroups,
      recentSessions,
      recentRecords,
      activeSessionsList,
      violations,
      deptStudentsRaw,
      studentReport,
      trendSessionsRaw,
      gradeSamples,
      quizAgg,
      submissionCount,
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
      db.attendanceSession.aggregate({
        where: { ...sessionWhere, status: 'completed' },
        _sum: { presentCount: true, absentCount: true, lateCount: true, expectedCount: true },
      }),
      db.course.findMany({
        where: courseWhere,
        select: { id: true, name: true, code: true, attendanceSessions: { select: { presentCount: true, expectedCount: true }, take: 20 } },
        take: 8,
      }),
      db.attendanceSession.groupBy({
        by: ['captureMethod'],
        where: sessionWhere,
        _count: { _all: true },
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
        ? db.user.groupBy({
            by: ['department'],
            where: { role: 'student', status: 'active' },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      buildStudentAttendanceStats(studentWhere, scope.level === 'all' ? 60 : 40),
      db.attendanceSession.findMany({
        where: { ...sessionWhere, status: 'completed' },
        select: {
          sessionDate: true,
          presentCount: true,
          absentCount: true,
          lateCount: true,
          expectedCount: true,
        },
        orderBy: { sessionDate: 'desc' },
        take: 60,
      }),
      db.gradeBook.findMany({
        where:
          scope.level === 'all'
            ? {}
            : scope.level === 'department'
              ? { student: { departmentId: scope.departmentId } }
              : { courseId: courseFilter },
        select: { score: true, maxScore: true },
        take: 800,
      }),
      db.quizAttempt.aggregate({
        where: scope.level === 'all' ? {} : { courseId: courseFilter },
        _count: { _all: true },
        _avg: { percentage: true },
      }),
      db.submission.count({
        where: scope.level === 'all' ? {} : { assignment: { courseId: courseFilter } },
      }),
    ]);

    const totalPresent = completedAgg._sum.presentCount ?? 0;
    const totalAbsent = completedAgg._sum.absentCount ?? 0;
    const totalLate = completedAgg._sum.lateCount ?? 0;
    const totalExpected = completedAgg._sum.expectedCount ?? 0;
    const overallAttendance = totalExpected > 0 ? Math.round((totalPresent / totalExpected) * 100) : 0;

    const courseAttendance = courses.map((c) => {
      const attended = c.attendanceSessions.reduce((s, a) => s + a.presentCount, 0);
      const expected = c.attendanceSessions.reduce((s, a) => s + a.expectedCount, 0);
      return { id: c.id, name: c.name, code: c.code, attendance: attended, expected, percentage: expected > 0 ? Math.round((attended / expected) * 100) : 0 };
    });

    const captureMethods: Record<string, number> = {};
    captureMethodGroups.forEach((s) => { captureMethods[s.captureMethod] = s._count._all; });

    const violationByType: Record<string, number> = {};
    const violationBySeverity: Record<string, number> = {};
    violations.forEach((v) => {
      violationByType[v.type] = (violationByType[v.type] || 0) + 1;
      violationBySeverity[v.severity] = (violationBySeverity[v.severity] || 0) + 1;
    });

    let deptAttendance: { department: string; students: number }[] = [];
    if (scope.level === 'department') {
      deptAttendance = [{ department: deptName ?? 'Department', students: totalStudents }];
    } else if (scope.level === 'all') {
      deptAttendance = deptStudentsRaw.map((g) => ({
        department: g.department || 'N/A',
        students: g._count._all,
      }));
    }

    const weeklyRateTrend = buildWeeklyTrend(trendSessionsRaw);
    const weeklyTrend = weeklyRateTrend.map((w) => ({
      date: w.week,
      present: w.present,
      absent: w.absent,
      late: w.late,
      rate: w.rate,
    }));

    const departmentAnalytics =
      analyticsScope === 'campus' ? buildDepartmentAnalytics(studentReport, thresholds) : [];

    const atRiskStudents = studentReport
      .filter((s) => s.stats.total > 0 && s.stats.percentage < thresholds.eligibilityPct)
      .slice(0, 8);

    const topPerformers = [...studentReport]
      .filter((s) => s.stats.total >= 3)
      .sort((a, b) => b.stats.percentage - a.stats.percentage)
      .slice(0, 5);

    const avgGradePct =
      gradeSamples.length > 0
        ? Math.round(
            gradeSamples.reduce((s, g) => s + (g.score / g.maxScore) * 100, 0) / gradeSamples.length
          )
        : 0;

    const scopeKey = scope.level === 'all' ? 'campus' : scope.level === 'department' ? 'department' : 'instructor';

    const knuct = role === 'super_admin' ? await getKnuctDashboardStats() : undefined;

    return NextResponse.json({
      scope: scopeKey,
      thresholds,
      scopeLabel: scopeLabelText,
      analyticsScope,
      knuct,
      stats: { totalStudents, totalFaculty, totalCourses, totalSessions, activeSessions, pendingViolations: totalViolations, totalEnrollments, overallAttendance, totalPresent, totalAbsent, totalLate },
      analytics: {
        atRiskCount: atRiskStudents.length,
        avgGradePct,
        quizAttempts: quizAgg._count._all,
        avgQuizScore: Math.round(quizAgg._avg.percentage ?? 0),
        submissions: submissionCount,
        weeklyRateTrend,
        departmentAnalytics,
        atRiskStudents,
        topPerformers,
      },
      courseAttendance, captureMethods, weeklyTrend, recentActivity: recentRecords, activeSessionsList,
      deptAttendance, violationByType, violationBySeverity,
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 });
  }
}
