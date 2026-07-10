import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { resolveStudentId, getCampusScope, buildCourseIdFilter, requireSection } from '@/lib/auth-helpers';
import {
  attendanceRiskStatus,
  buildDepartmentAnalytics,
  buildStudentAttendanceStats,
  buildViolationAnalytics,
  buildWeeklyTrend,
  getDepartmentName,
  scopeLabel,
} from '@/lib/reports-analytics';
import { getAttendanceThresholds } from '@/lib/system-config';
import { rateLimitByUser } from '@/lib/api-rate-limit';

export async function GET(request: Request) {
  try {
    const { error, session } = await requireSection('reports');
    if (error || !session) return error;

    const limited = await rateLimitByUser(request, session.user.id, 'reports', 40, 60_000);
    if (limited) return limited;

    const thresholds = await getAttendanceThresholds();

    const { searchParams } = new URL(request.url);
    const { studentId, error: studentError } = await resolveStudentId(session, searchParams.get('studentId'));
    if (studentError) return studentError;
    const isStudent = !!studentId;

    // ── STUDENT-SPECIFIC REPORT ─────────────────────────────────────────
    if (isStudent) {
      // 1. Get student profile
      const student = await db.user.findUnique({
        where: { id: studentId },
        select: {
          id: true, name: true, email: true, employeeId: true, department: true, role: true,
        },
      });

      if (!student) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      }

      // 2. Get enrolled courses
      const enrollments = await db.courseEnrollment.findMany({
        where: { studentId, status: 'enrolled' },
        include: {
          course: {
            select: {
              id: true, name: true, code: true, credits: true, type: true, semester: true,
              instructor: { select: { name: true } },
              _count: { select: { assignments: true, modules: true, enrollments: true } },
            },
          },
        },
      });
      const enrolledCourses = enrollments.map(e => e.course);
      const enrolledCourseIds = enrolledCourses.map(c => c.id);

      const [presentCount, absentCount, lateCount, totalSessions] = await Promise.all([
        db.attendanceRecord.count({ where: { studentId, status: 'present' } }),
        db.attendanceRecord.count({ where: { studentId, status: 'absent' } }),
        db.attendanceRecord.count({ where: { studentId, status: 'late' } }),
        db.attendanceRecord.count({ where: { studentId } }),
      ]);
      const overallPercentage = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;

      const attendanceRecords = await db.attendanceRecord.findMany({
        where: { studentId },
        include: {
          session: {
            select: {
              id: true, sessionDate: true, startTime: true, endTime: true, status: true,
              course: { select: { id: true, name: true, code: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 80,
      });

      // Per-course attendance breakdown
      const courseAttendanceMap = new Map<string, { course: { id: string; name: string; code: string }; present: number; absent: number; late: number; total: number }>();
      attendanceRecords.forEach(r => {
        const cId = r.session.course.id;
        if (!courseAttendanceMap.has(cId)) {
          courseAttendanceMap.set(cId, { course: r.session.course, present: 0, absent: 0, late: 0, total: 0 });
        }
        const entry = courseAttendanceMap.get(cId)!;
        entry.total++;
        if (r.status === 'present') entry.present++;
        else if (r.status === 'absent') entry.absent++;
        else if (r.status === 'late') entry.late++;
      });
      const courseAttendance = Array.from(courseAttendanceMap.values()).map(ca => ({
        ...ca,
        percentage: ca.total > 0 ? Math.round((ca.present / ca.total) * 100) : 0,
      }));

      // Recent attendance sessions (for the student's courses)
      const attendanceSummary = await db.attendanceSession.findMany({
        where: { courseId: { in: enrolledCourseIds }, status: 'completed' },
        include: {
          course: { select: { name: true, code: true } },
          creator: { select: { name: true } },
        },
        orderBy: { sessionDate: 'desc' },
        take: 15,
      });

      // 4. Student Submissions & Grades
      const submissions = await db.submission.findMany({
        where: { studentId },
        include: {
          assignment: {
            select: { id: true, title: true, maxScore: true, dueDate: true, type: true,
              course: { select: { id: true, name: true, code: true } } },
          },
        },
        orderBy: { submittedAt: 'desc' },
      });

      const gradedSubmissions = submissions.filter(s => s.score !== null);
      const avgAssignmentScore = gradedSubmissions.length > 0
        ? Math.round(gradedSubmissions.reduce((s, sub) => s + ((sub.score || 0) / sub.assignment.maxScore) * 100, 0) / gradedSubmissions.length)
        : null;

      // 5. Student Quiz Attempts
      const quizAttempts = await db.quizAttempt.findMany({
        where: { studentId },
        include: { course: { select: { name: true, code: true } } },
        orderBy: { startedAt: 'desc' },
        take: 30,
      });

      const avgQuizScore = quizAttempts.length > 0
        ? Math.round(quizAttempts.reduce((s, a) => s + a.percentage, 0) / quizAttempts.length)
        : 0;
      const bestQuizScore = quizAttempts.length > 0 ? Math.max(...quizAttempts.map(a => a.percentage)) : 0;

      // 6. Grade Book entries
      const gradeEntries = await db.gradeBook.findMany({
        where: { studentId },
        include: { course: { select: { id: true, name: true, code: true } } },
        orderBy: { gradedAt: 'desc' },
      });

      const gradeDistribution: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
      gradeEntries.forEach(g => {
        const pct = (g.score / g.maxScore) * 100;
        if (pct >= 90) gradeDistribution.A++;
        else if (pct >= 75) gradeDistribution.B++;
        else if (pct >= 60) gradeDistribution.C++;
        else if (pct >= 40) gradeDistribution.D++;
        else gradeDistribution.F++;
      });

      // Per-course grade breakdown
      const courseGradesMap = new Map<string, { course: { id: string; name: string; code: string }; grades: { component: string; score: number; maxScore: number; weightage: number }[] }>();
      gradeEntries.forEach(g => {
        const cId = g.courseId;
        if (!courseGradesMap.has(cId)) {
          courseGradesMap.set(cId, { course: g.course, grades: [] });
        }
        courseGradesMap.get(cId)!.grades.push({
          component: g.component,
          score: g.score,
          maxScore: g.maxScore,
          weightage: g.weightage,
        });
      });
      const courseGrades = Array.from(courseGradesMap.entries()).map(([courseId, data]) => {
        const totalWeighted = data.grades.reduce((s, g) => s + (g.score / g.maxScore) * g.weightage, 0);
        const totalWeightage = data.grades.reduce((s, g) => s + g.weightage, 0);
        const overallScore = totalWeightage > 0 ? Math.round((totalWeighted / totalWeightage) * 100) : 0;
        return {
          courseId,
          course: data.course,
          grades: data.grades,
          overallScore,
        };
      });

      const attendanceTrend = buildWeeklyTrend(
        attendanceRecords.map((r) => ({
          sessionDate: r.session.sessionDate,
          presentCount: r.status === 'present' ? 1 : 0,
          absentCount: r.status === 'absent' ? 1 : 0,
          lateCount: r.status === 'late' ? 1 : 0,
          expectedCount: 1,
        }))
      );

      const codingAttempts = quizAttempts.length;

      const violations = await db.attendanceViolation.findMany({
        where: { studentId },
        include: {
          record: { select: { session: { select: { sessionDate: true, course: { select: { name: true, code: true } } } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      return NextResponse.json({
        isStudent: true,
        isParent: session!.user.role === 'parent',
        analyticsScope: 'student' as const,
        thresholds,
        riskStatus: attendanceRiskStatus(overallPercentage, totalSessions, thresholds),
        student: {
          id: student.id,
          name: student.name,
          email: student.email,
          employeeId: student.employeeId,
          department: student.department,
        },
        enrolledCourses,
        attendance: {
          totalSessions,
          presentCount,
          absentCount,
          lateCount,
          overallPercentage,
          courseAttendance,
          recentSessions: attendanceSummary,
          weeklyTrend: attendanceTrend,
        },
        assignments: {
          total: submissions.length,
          graded: gradedSubmissions.length,
          pending: submissions.filter(s => s.status === 'submitted').length,
          avgScore: avgAssignmentScore,
          recent: submissions.slice(0, 10).map(s => ({
            id: s.id,
            title: s.assignment.title,
            course: s.assignment.course,
            score: s.score,
            maxScore: s.assignment.maxScore,
            status: s.status,
            feedback: s.feedback,
            submittedAt: s.submittedAt,
            gradedAt: s.gradedAt,
          })),
        },
        quizzes: {
          totalAttempts: quizAttempts.length,
          avgScore: avgQuizScore,
          bestScore: bestQuizScore,
          codingAttempts,
          recent: quizAttempts.slice(0, 10),
        },
        grades: {
          distribution: gradeDistribution,
          courseGrades,
          totalEntries: gradeEntries.length,
        },
        violations,
      });
    }

    const scope = await getCampusScope(session);
    const courseFilter = buildCourseIdFilter(scope);
    const sessionWhere = courseFilter ? { courseId: courseFilter } : {};
    const courseWhere = courseFilter ? { isActive: true, id: courseFilter } : { isActive: true };

    let studentWhere: Record<string, unknown> = { role: 'student', status: 'active' };
    let violationWhere: Record<string, unknown> = {};

    if (scope.level === 'department') {
      studentWhere = { role: 'student', status: 'active', departmentId: scope.departmentId };
      violationWhere = { violator: { departmentId: scope.departmentId } };
    } else if (scope.level === 'instructor') {
      const enrollments = await db.courseEnrollment.findMany({
        where: { courseId: { in: scope.courseIds }, status: 'enrolled' },
        select: { studentId: true },
        distinct: ['studentId'],
      });
      const studentIds = enrollments.map((e) => e.studentId);
      studentWhere = { id: { in: studentIds.length > 0 ? studentIds : ['__none__'] }, role: 'student', status: 'active' };
    }

    const deptName = scope.level === 'department' ? await getDepartmentName(scope.departmentId) : undefined;
    const { scope: analyticsScope, label: scopeLabelText } = scopeLabel(scope, deptName);

    const [
      totalStudents,
      totalCourses,
      totalEnrollments,
      attendanceSummary,
      studentAttendanceReport,
      coursePerformance,
      violationReport,
      allGrades,
      sessionAgg,
      captureGroups,
      quizAgg,
      submissionCount,
    ] = await Promise.all([
      db.user.count({ where: studentWhere }),
      db.course.count({ where: courseWhere }),
      db.courseEnrollment.count({
        where: scope.level === 'all'
          ? { status: 'enrolled' }
          : { status: 'enrolled', courseId: courseFilter ?? { in: ['__none__'] } },
      }),
      db.attendanceSession.findMany({
        where: { ...sessionWhere, status: 'completed' },
        include: {
          course: { select: { name: true, code: true } },
          creator: { select: { name: true } },
        },
        orderBy: { sessionDate: 'desc' },
        take: 40,
      }),
      buildStudentAttendanceStats(studentWhere, scope.level === 'all' ? 80 : 50),
      db.course.findMany({
        where: courseWhere,
        select: {
          id: true, name: true, code: true, credits: true, type: true,
          instructor: { select: { name: true } },
          _count: { select: { enrollments: true, assignments: true, quizAttempts: true } },
          gradeBooks: { select: { score: true, maxScore: true, component: true }, take: 200 },
        },
        take: scope.level === 'instructor' ? 20 : 30,
      }),
      db.attendanceViolation.findMany({
        where: violationWhere,
        include: {
          violator: { select: { name: true, employeeId: true, department: true } },
          record: { select: { session: { select: { sessionDate: true, course: { select: { name: true } } } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      db.gradeBook.findMany({
        where:
          scope.level === 'all'
            ? {}
            : scope.level === 'department'
              ? { student: { departmentId: scope.departmentId } }
              : { courseId: { in: scope.courseIds.length > 0 ? scope.courseIds : ['__none__'] } },
        select: { score: true, maxScore: true, component: true, studentId: true },
        take: 2000,
      }),
      db.attendanceSession.aggregate({
        where: { ...sessionWhere, status: 'completed' },
        _sum: { presentCount: true, absentCount: true, lateCount: true, expectedCount: true },
        _count: { _all: true },
      }),
      db.attendanceSession.groupBy({
        by: ['captureMethod'],
        where: sessionWhere,
        _count: { _all: true },
      }),
      db.quizAttempt.aggregate({
        where: scope.level === 'all'
          ? {}
          : { courseId: courseFilter ?? { in: ['__none__'] } },
        _count: { _all: true },
        _avg: { percentage: true },
      }),
      db.submission.count({
        where: scope.level === 'all'
          ? {}
          : { assignment: { courseId: courseFilter ?? { in: ['__none__'] } } },
      }),
    ]);

    const coursePerfReport = coursePerformance.map((c) => {
      const avgGrade = c.gradeBooks.length > 0
        ? Math.round(c.gradeBooks.reduce((s, g) => s + (g.score / g.maxScore) * 100, 0) / c.gradeBooks.length)
        : null;
      return { ...c, gradeBooks: undefined, avgGrade };
    });

    const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    allGrades.forEach((g) => {
      const pct = (g.score / g.maxScore) * 100;
      if (pct >= 90) gradeDistribution.A++;
      else if (pct >= 75) gradeDistribution.B++;
      else if (pct >= 60) gradeDistribution.C++;
      else if (pct >= 40) gradeDistribution.D++;
      else gradeDistribution.F++;
    });

    const weeklyAttendanceTrend = buildWeeklyTrend(attendanceSummary);
    const departmentAnalytics =
      analyticsScope === 'campus' ? buildDepartmentAnalytics(studentAttendanceReport, thresholds) : [];

    const atRiskStudents = studentAttendanceReport
      .filter((s) => s.stats.total > 0 && s.stats.percentage < thresholds.eligibilityPct)
      .slice(0, 20);

    const topPerformers = [...studentAttendanceReport]
      .filter((s) => s.stats.total >= 3)
      .sort((a, b) => b.stats.percentage - a.stats.percentage)
      .slice(0, 10);

    const violationAnalytics = buildViolationAnalytics(violationReport);

    const captureMethodBreakdown: Record<string, number> = {};
    captureGroups.forEach((g) => {
      captureMethodBreakdown[g.captureMethod] = g._count._all;
    });

    const expectedSum = sessionAgg._sum.expectedCount ?? 0;
    const presentSum = sessionAgg._sum.presentCount ?? 0;
    const avgAttendancePct = expectedSum > 0 ? Math.round((presentSum / expectedSum) * 100) : 0;

    const avgGradePct =
      allGrades.length > 0
        ? Math.round(
            allGrades.reduce((s, g) => s + (g.score / g.maxScore) * 100, 0) / allGrades.length
          )
        : 0;

    return NextResponse.json({
      isStudent: false,
      analyticsScope,
      thresholds,
      scopeLabel: scopeLabelText,
      role: session!.user.role,
      kpis: {
        totalStudents,
        totalCourses,
        totalEnrollments,
        completedSessions: sessionAgg._count._all,
        avgAttendancePct,
        atRiskCount: atRiskStudents.length,
        pendingViolations: violationAnalytics.pending,
        avgGradePct,
        quizAttempts: quizAgg._count._all,
        avgQuizScore: Math.round(quizAgg._avg.percentage ?? 0),
        submissions: submissionCount,
      },
      weeklyAttendanceTrend,
      departmentAnalytics,
      atRiskStudents,
      topPerformers,
      violationAnalytics,
      captureMethodBreakdown,
      lmsEngagement: {
        coursesWithGrades: coursePerfReport.filter((c) => c.avgGrade !== null).length,
        topCourses: [...coursePerfReport]
          .sort((a, b) => (b._count?.enrollments ?? 0) - (a._count?.enrollments ?? 0))
          .slice(0, 8)
          .map((c) => ({
            id: c.id,
            code: c.code,
            name: c.name,
            enrollments: c._count.enrollments,
            assignments: c._count.assignments,
            quizAttempts: c._count.quizAttempts,
            avgGrade: c.avgGrade,
            instructor: c.instructor?.name ?? 'TBA',
          })),
      },
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
