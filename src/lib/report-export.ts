import type { ReportDocumentBrand } from '@/lib/report-brand';
import { reportIdentityLines } from '@/lib/report-brand';
import { BRAND } from '@/lib/branding';

function escapeCsv(value: string | number | null | undefined): string {
  if (value == null) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const bom = '\uFEFF';
  const content = bom + rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvLetterhead(
  brand: ReportDocumentBrand | undefined,
  title: string,
): (string | number | null | undefined)[][] {
  const appName = brand?.appName?.trim() || BRAND.name;
  const locale = brand?.locale || 'en-IN';
  const rows: (string | number | null | undefined)[][] = [[`${appName} — ${title}`]];
  for (const line of reportIdentityLines(
    brand ?? { appName, companyName: '', locale, brandingPrimaryColor: '' },
  )) {
    if (line === appName) continue;
    rows.push([line]);
  }
  rows.push(['Generated', new Date().toLocaleString(locale)]);
  rows.push([]);
  return rows;
}

export type StudentExportData = {
  student: { name: string; email: string; employeeId: string | null; department: string | null };
  riskStatus?: string;
  attendance: {
    overallPercentage: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    totalSessions: number;
    courseAttendance: {
      course: { code: string; name: string };
      present: number;
      absent: number;
      late: number;
      total: number;
      percentage: number;
    }[];
    weeklyTrend?: { week: string; rate: number; present: number; absent: number; late: number }[];
  };
  assignments: { total: number; graded: number; avgScore: number | null };
  quizzes: { totalAttempts: number; avgScore: number; bestScore: number };
  grades: { totalEntries: number; distribution: Record<string, number> };
  violations: { type: string; severity: string; reviewStatus: string }[];
};

export type StaffExportData = {
  scopeLabel: string;
  analyticsScope: string;
  thresholds?: { eligibilityPct: number; condonationPct: number };
  kpis: {
    totalStudents: number;
    avgAttendancePct: number;
    atRiskCount: number;
    avgGradePct: number;
    quizAttempts: number;
    avgQuizScore: number;
    totalEnrollments: number;
    submissions: number;
  };
  weeklyAttendanceTrend: { week: string; rate: number; present: number; absent: number; late: number }[];
  departmentAnalytics: { department: string; students: number; avgAttendance: number; atRisk: number }[];
  atRiskStudents: {
    name: string;
    employeeId: string | null;
    department: string | null;
    stats: { percentage: number; total: number };
  }[];
  studentAttendanceReport?: {
    name: string;
    employeeId: string | null;
    department: string | null;
    stats: { present: number; absent: number; late: number; total: number; percentage: number };
  }[];
  lmsEngagement: { topCourses: { code: string; name: string; enrollments: number; avgGrade: number | null }[] };
};

export function exportStudentReportCsv(data: StudentExportData, brand?: ReportDocumentBrand) {
  const rows: (string | number | null | undefined)[][] = [
    ...csvLetterhead(brand, 'Student Report'),
    ['Student', data.student.name],
    ['Email', data.student.email],
    ['ID', data.student.employeeId],
    ['Department', data.student.department],
    ['Risk status', data.riskStatus ?? ''],
    [],
    ['Attendance summary'],
    ['Overall %', data.attendance.overallPercentage],
    ['Present', data.attendance.presentCount],
    ['Absent', data.attendance.absentCount],
    ['Late', data.attendance.lateCount],
    ['Total sessions', data.attendance.totalSessions],
    [],
    ['Course attendance'],
    ['Code', 'Course', 'Present', 'Absent', 'Late', 'Total', '%'],
    ...data.attendance.courseAttendance.map((c) => [
      c.course.code,
      c.course.name,
      c.present,
      c.absent,
      c.late,
      c.total,
      c.percentage,
    ]),
    [],
    ['Weekly trend'],
    ['Week', 'Rate %', 'Present', 'Absent', 'Late'],
    ...(data.attendance.weeklyTrend ?? []).map((w) => [w.week, w.rate, w.present, w.absent, w.late]),
    [],
    ['Academics'],
    ['Assignments', data.assignments.total],
    ['Graded', data.assignments.graded],
    ['Avg assignment %', data.assignments.avgScore ?? ''],
    ['Quiz attempts', data.quizzes.totalAttempts],
    ['Avg quiz %', data.quizzes.avgScore],
    ['Best quiz %', data.quizzes.bestScore],
    ['Grade entries', data.grades.totalEntries],
    [],
    ['Grade distribution', 'Count'],
    ...Object.entries(data.grades.distribution).map(([grade, count]) => [grade, count]),
    [],
    ['Violations'],
    ['Type', 'Severity', 'Status'],
    ...data.violations.map((v) => [v.type, v.severity, v.reviewStatus]),
  ];

  const slug = data.student.employeeId || data.student.name.split(' ')[0];
  downloadCsv(`student-report-${slug}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

export function exportStaffReportCsv(data: StaffExportData, brand?: ReportDocumentBrand) {
  const eligibilityPct = data.thresholds?.eligibilityPct ?? 75;
  const rows: (string | number | null | undefined)[][] = [
    ...csvLetterhead(brand, 'Analytics Report'),
    ['Scope', data.scopeLabel],
    [],
    ['KPIs'],
    ['Students', data.kpis.totalStudents],
    ['Avg attendance %', data.kpis.avgAttendancePct],
    [`At risk (<${eligibilityPct}%)`, data.kpis.atRiskCount],
    ['Avg grade %', data.kpis.avgGradePct],
    ['Quiz attempts', data.kpis.quizAttempts],
    ['Avg quiz %', data.kpis.avgQuizScore],
    ['Enrollments', data.kpis.totalEnrollments],
    ['Submissions', data.kpis.submissions],
    [],
    ['Weekly attendance trend'],
    ['Week', 'Rate %', 'Present', 'Absent', 'Late'],
    ...data.weeklyAttendanceTrend.map((w) => [w.week, w.rate, w.present, w.absent, w.late]),
  ];

  if (data.departmentAnalytics.length > 0) {
    rows.push([], ['Department breakdown'], ['Department', 'Students', 'Avg %', 'At risk']);
    data.departmentAnalytics.forEach((d) => {
      rows.push([d.department, d.students, d.avgAttendance, d.atRisk]);
    });
  }

  rows.push(
    [],
    ['At-risk students'],
    ['Name', 'ID', 'Department', 'Sessions', '%'],
    ...data.atRiskStudents.map((s) => [
      s.name,
      s.employeeId,
      s.department,
      s.stats.total,
      s.stats.percentage,
    ]),
    [],
    ['Student attendance roster'],
    ['Name', 'ID', 'Department', 'Present', 'Absent', 'Late', 'Total', '%'],
    ...(data.studentAttendanceReport ?? []).map((s) => [
      s.name,
      s.employeeId,
      s.department,
      s.stats.present,
      s.stats.absent,
      s.stats.late,
      s.stats.total,
      s.stats.percentage,
    ]),
    [],
    ['Top courses'],
    ['Code', 'Course', 'Enrolled', 'Avg grade %'],
    ...data.lmsEngagement.topCourses.map((c) => [
      c.code,
      c.name,
      c.enrollments,
      c.avgGrade ?? '',
    ]),
  );

  const scopeSlug = data.analyticsScope.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  downloadCsv(`analytics-${scopeSlug}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}
