import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAuth, resolveStudentId, requireCampusRead, getCampusScope, buildCourseIdFilter, requireSection } from '@/lib/auth-helpers';

export async function GET(request: Request) {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const { studentId, error: studentError } = await resolveStudentId(session!, searchParams.get('studentId'));
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

      // 3. Student Attendance Records
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
        take: 100,
      });

      const totalSessions = attendanceRecords.length;
      const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
      const absentCount = attendanceRecords.filter(r => r.status === 'absent').length;
      const lateCount = attendanceRecords.filter(r => r.status === 'late').length;
      const overallPercentage = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;

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

      // 7. Student Violations
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

    const { error: sectionError } = await requireSection('reports');
    if (sectionError) return sectionError;

    const { error: campusError } = await requireCampusRead();
    if (campusError) return campusError;

    const scope = await getCampusScope(session!);
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

    const attendanceSummary = await db.attendanceSession.findMany({
      where: { ...sessionWhere, status: 'completed' },
      include: {
        course: { select: { name: true, code: true } },
        creator: { select: { name: true } },
      },
      orderBy: { sessionDate: 'desc' },
      take: 30,
    });

    // 2. Student Attendance Detail
    const studentAttendance = await db.user.findMany({
      where: studentWhere,
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
      where: courseWhere,
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
      where: violationWhere,
      include: {
        violator: { select: { name: true, employeeId: true, department: true } },
        record: { select: { session: { select: { sessionDate: true, course: { select: { name: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    // 5. Grade Distribution
    const gradeWhere = scope.level === 'all'
      ? {}
      : scope.level === 'department'
        ? { student: { departmentId: scope.departmentId } }
        : { courseId: { in: scope.courseIds.length > 0 ? scope.courseIds : ['__none__'] } };

    const allGrades = await db.gradeBook.findMany({
      where: gradeWhere,
      select: { score: true, maxScore: true, component: true, studentId: true },
    });
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
      isStudent: false,
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
