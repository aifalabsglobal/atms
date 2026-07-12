import type { StudentExportData, StaffExportData } from '@/lib/report-export';
import { BRAND } from '@/lib/branding';
import type { ReportDocumentBrand } from '@/lib/report-brand';
import { reportIdentityLines } from '@/lib/report-brand';
import { jsPDF } from 'jspdf';

export type ReportPdfBrand = ReportDocumentBrand;

function brandLabel(brand?: ReportPdfBrand) {
  return brand?.appName?.trim() || BRAND.name;
}

function downloadPdfBlob(filename: string, doc: jsPDF) {
  doc.save(filename);
}

function addFooter(doc: jsPDF, page: number, brand?: ReportPdfBrand) {
  const h = doc.internal.pageSize.getHeight();
  const w = doc.internal.pageSize.getWidth();
  doc.setFontSize(8);
  doc.setTextColor(120);
  const left = brandLabel(brand);
  const rightBits = [brand?.campusCode, brand?.aisheCode ? `AISHE ${brand.aisheCode}` : '']
    .filter(Boolean)
    .join(' · ');
  doc.text(`${left} · page ${page}`, 14, h - 8);
  if (rightBits) {
    doc.text(rightBits, w - 14, h - 8, { align: 'right' });
  }
  doc.setTextColor(0);
}

function ensureSpace(
  doc: jsPDF,
  y: number,
  needed: number,
  pageRef: { n: number },
  brand?: ReportPdfBrand,
): number {
  const h = doc.internal.pageSize.getHeight();
  if (y + needed < h - 16) return y;
  addFooter(doc, pageRef.n, brand);
  doc.addPage();
  pageRef.n += 1;
  return 18;
}

function brandRgb(brand?: ReportPdfBrand): [number, number, number] {
  const hex = brand?.brandingPrimaryColor?.trim() || '#1A3C6E';
  const m = /^#?([0-9A-Fa-f]{6})$/.exec(hex);
  if (!m) return [26, 60, 110];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Letterhead: institute identity under General name + Organization campus fields. */
function addReportHeader(
  doc: jsPDF,
  brand: ReportPdfBrand | undefined,
  title: string,
  subtitle?: string,
): number {
  const [br, bg, bb] = brandRgb(brand);
  const name = brandLabel(brand);
  const locale = brand?.locale || 'en-IN';
  let y = 16;

  doc.setFontSize(16);
  doc.setTextColor(br, bg, bb);
  doc.text(`${name} — ${title}`, 14, y);
  y += 7;

  doc.setFontSize(9);
  doc.setTextColor(70);
  for (const line of reportIdentityLines(brand ?? { appName: name, companyName: '', locale, brandingPrimaryColor: '' })) {
    // Skip duplicating app name as company when identical
    if (line === name) continue;
    const wrapped = doc.splitTextToSize(line, 180);
    doc.text(wrapped, 14, y);
    y += wrapped.length * 4.2;
  }

  doc.setTextColor(80);
  doc.text(
    [subtitle, `Generated ${new Date().toLocaleString(locale)}`].filter(Boolean).join(' · '),
    14,
    y,
  );
  y += 6;

  doc.setDrawColor(br, bg, bb);
  doc.setLineWidth(0.3);
  doc.line(14, y, 196, y);
  y += 8;
  doc.setTextColor(0);
  return y;
}

export function exportStudentReportPdf(data: StudentExportData, brand?: ReportPdfBrand) {
  const doc = new jsPDF();
  const page = { n: 1 };
  let y = addReportHeader(doc, brand, 'Student Report');
  const [br, bg, bb] = brandRgb(brand);

  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.text(data.student.name, 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.text(`Email: ${data.student.email}`, 14, y);
  y += 5;
  doc.text(`ID: ${data.student.employeeId ?? '—'} · Dept: ${data.student.department ?? '—'}`, 14, y);
  y += 5;
  if (data.riskStatus) {
    doc.text(`Risk: ${data.riskStatus}`, 14, y);
    y += 8;
  } else {
    y += 4;
  }

  doc.setFontSize(12);
  doc.setTextColor(br, bg, bb);
  doc.text('Attendance', 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(
    `Overall ${data.attendance.overallPercentage}% · Present ${data.attendance.presentCount} · Absent ${data.attendance.absentCount} · Late ${data.attendance.lateCount} · Sessions ${data.attendance.totalSessions}`,
    14,
    y,
  );
  y += 8;

  doc.setFontSize(11);
  doc.text('Course attendance', 14, y);
  y += 6;
  doc.setFontSize(9);
  for (const c of data.attendance.courseAttendance.slice(0, 20)) {
    y = ensureSpace(doc, y, 6, page, brand);
    doc.text(`${c.course.code} — ${c.course.name}: ${c.percentage}% (${c.present}/${c.total})`, 14, y);
    y += 5;
  }

  y += 4;
  y = ensureSpace(doc, y, 30, page, brand);
  doc.setFontSize(11);
  doc.setTextColor(br, bg, bb);
  doc.text('Academics', 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(
    `Assignments ${data.assignments.total} (graded ${data.assignments.graded}, avg ${data.assignments.avgScore ?? '—'}%)`,
    14,
    y,
  );
  y += 5;
  doc.text(
    `Quizzes ${data.quizzes.totalAttempts} · avg ${data.quizzes.avgScore}% · best ${data.quizzes.bestScore}%`,
    14,
    y,
  );
  y += 5;
  doc.text(
    `Grades: ${Object.entries(data.grades.distribution)
      .map(([g, n]) => `${g}=${n}`)
      .join(' · ')}`,
    14,
    y,
  );
  y += 8;

  if (data.violations.length > 0) {
    y = ensureSpace(doc, y, 20, page, brand);
    doc.setFontSize(11);
    doc.setTextColor(br, bg, bb);
    doc.text('Violations', 14, y);
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(0);
    for (const v of data.violations.slice(0, 15)) {
      y = ensureSpace(doc, y, 5, page, brand);
      doc.text(`${v.type} · ${v.severity} · ${v.reviewStatus}`, 14, y);
      y += 5;
    }
  }

  addFooter(doc, page.n, brand);
  const slug = data.student.employeeId || data.student.name.split(' ')[0];
  downloadPdfBlob(`student-report-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`, doc);
}

export function exportStaffReportPdf(data: StaffExportData, brand?: ReportPdfBrand) {
  const doc = new jsPDF();
  const page = { n: 1 };
  let y = addReportHeader(doc, brand, 'Analytics Report', data.scopeLabel);
  const [br, bg, bb] = brandRgb(brand);

  doc.setFontSize(12);
  doc.setTextColor(br, bg, bb);
  doc.text('KPIs', 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(0);
  const kpiLines = [
    `Students: ${data.kpis.totalStudents} · Avg attendance: ${data.kpis.avgAttendancePct}% · At risk (<${data.thresholds?.eligibilityPct ?? 75}%): ${data.kpis.atRiskCount}`,
    `Avg grade: ${data.kpis.avgGradePct}% · Quiz attempts: ${data.kpis.quizAttempts} · Avg quiz: ${data.kpis.avgQuizScore}%`,
    `Enrollments: ${data.kpis.totalEnrollments} · Submissions: ${data.kpis.submissions}`,
  ];
  for (const line of kpiLines) {
    doc.text(line, 14, y);
    y += 5;
  }
  y += 4;

  if (data.weeklyAttendanceTrend.length > 0) {
    y = ensureSpace(doc, y, 20, page, brand);
    doc.setFontSize(11);
    doc.setTextColor(br, bg, bb);
    doc.text('Weekly attendance trend', 14, y);
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(0);
    for (const w of data.weeklyAttendanceTrend) {
      y = ensureSpace(doc, y, 5, page, brand);
      doc.text(`${w.week}: ${w.rate}% (P${w.present}/A${w.absent}/L${w.late})`, 14, y);
      y += 5;
    }
    y += 3;
  }

  if (data.departmentAnalytics.length > 0) {
    y = ensureSpace(doc, y, 20, page, brand);
    doc.setFontSize(11);
    doc.setTextColor(br, bg, bb);
    doc.text('Department breakdown', 14, y);
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(0);
    for (const d of data.departmentAnalytics) {
      y = ensureSpace(doc, y, 5, page, brand);
      doc.text(`${d.department}: ${d.students} students · avg ${d.avgAttendance}% · at risk ${d.atRisk}`, 14, y);
      y += 5;
    }
    y += 3;
  }

  if (data.atRiskStudents.length > 0) {
    y = ensureSpace(doc, y, 20, page, brand);
    doc.setFontSize(11);
    doc.setTextColor(br, bg, bb);
    doc.text('At-risk students', 14, y);
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(0);
    for (const s of data.atRiskStudents.slice(0, 25)) {
      y = ensureSpace(doc, y, 5, page, brand);
      doc.text(
        `${s.name} (${s.employeeId ?? '—'}) · ${s.department ?? '—'} · ${s.stats.percentage}% / ${s.stats.total} sessions`,
        14,
        y,
      );
      y += 5;
    }
    y += 3;
  }

  if (data.lmsEngagement.topCourses.length > 0) {
    y = ensureSpace(doc, y, 20, page, brand);
    doc.setFontSize(11);
    doc.setTextColor(br, bg, bb);
    doc.text('Top courses', 14, y);
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(0);
    for (const c of data.lmsEngagement.topCourses) {
      y = ensureSpace(doc, y, 5, page, brand);
      doc.text(`${c.code} — ${c.name}: ${c.enrollments} enrolled · avg grade ${c.avgGrade ?? '—'}%`, 14, y);
      y += 5;
    }
  }

  addFooter(doc, page.n, brand);
  const scopeSlug = data.analyticsScope.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  downloadPdfBlob(`analytics-${scopeSlug}-${new Date().toISOString().slice(0, 10)}.pdf`, doc);
}
