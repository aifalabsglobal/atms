import { db } from '@/lib/db';
import type { CampusScope } from '@/lib/auth-helpers';
import { DEFAULT_ATTENDANCE_THRESHOLDS, type AttendanceThresholds } from '@/lib/system-config-defaults';

export type AnalyticsScope = 'campus' | 'department' | 'instructor';

export function scopeLabel(scope: CampusScope, departmentName?: string): { scope: AnalyticsScope; label: string } {
  if (scope.level === 'all') return { scope: 'campus', label: 'Campus-wide' };
  if (scope.level === 'department') {
    return { scope: 'department', label: departmentName ? `${departmentName} Department` : 'Department' };
  }
  return { scope: 'instructor', label: 'My courses' };
}

function weekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setUTCDate(diff));
  return monday.toISOString().split('T')[0];
}

export function buildWeeklyTrend(
  sessions: { sessionDate: string; presentCount: number; absentCount: number; lateCount: number; expectedCount: number }[]
) {
  const map = new Map<string, { week: string; present: number; absent: number; late: number; sessions: number }>();
  for (const s of sessions) {
    const key = weekKey(s.sessionDate);
    const row = map.get(key) ?? { week: key, present: 0, absent: 0, late: 0, sessions: 0 };
    row.present += s.presentCount;
    row.absent += s.absentCount;
    row.late += s.lateCount;
    row.sessions += 1;
    map.set(key, row);
  }
  return Array.from(map.values())
    .sort((a, b) => a.week.localeCompare(b.week))
    .slice(-8)
    .map((w) => ({
      ...w,
      rate: w.present + w.absent + w.late > 0
        ? Math.round((w.present / (w.present + w.absent + w.late)) * 100)
        : 0,
    }));
}

export async function buildStudentAttendanceStats(studentWhere: Record<string, unknown>, limit = 50) {
  const students = await db.user.findMany({
    where: studentWhere,
    select: { id: true, name: true, employeeId: true, department: true },
    take: limit,
    orderBy: { name: 'asc' },
  });

  if (!students.length) return [];

  const studentIds = students.map((s) => s.id);
  const grouped = await db.attendanceRecord.groupBy({
    by: ['studentId', 'status'],
    where: { studentId: { in: studentIds } },
    _count: { _all: true },
  });

  const statsMap = new Map<string, { present: number; absent: number; late: number; total: number }>();
  for (const row of grouped) {
    const cur = statsMap.get(row.studentId) ?? { present: 0, absent: 0, late: 0, total: 0 };
    const n = row._count._all;
    cur.total += n;
    if (row.status === 'present') cur.present += n;
    else if (row.status === 'absent') cur.absent += n;
    else if (row.status === 'late') cur.late += n;
    statsMap.set(row.studentId, cur);
  }

  return students
    .map((s) => {
      const stats = statsMap.get(s.id) ?? { present: 0, absent: 0, late: 0, total: 0 };
      const percentage = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
      return {
        ...s,
        stats: { ...stats, percentage },
      };
    })
    .sort((a, b) => a.stats.percentage - b.stats.percentage);
}

export function buildDepartmentAnalytics(
  studentReport: { department: string | null; stats: { percentage: number; total: number } }[],
  thresholds: AttendanceThresholds = DEFAULT_ATTENDANCE_THRESHOLDS,
) {
  const map = new Map<string, { department: string; students: number; totalPct: number; withRecords: number }>();
  for (const s of studentReport) {
    const dept = s.department || 'Unassigned';
    const row = map.get(dept) ?? { department: dept, students: 0, totalPct: 0, withRecords: 0 };
    row.students += 1;
    if (s.stats.total > 0) {
      row.totalPct += s.stats.percentage;
      row.withRecords += 1;
    }
    map.set(dept, row);
  }
  return Array.from(map.values())
    .map((d) => ({
      department: d.department,
      students: d.students,
      avgAttendance: d.withRecords > 0 ? Math.round(d.totalPct / d.withRecords) : 0,
      atRisk: studentReport.filter(
        (s) =>
          (s.department || 'Unassigned') === d.department &&
          s.stats.percentage < thresholds.eligibilityPct &&
          s.stats.total > 0
      ).length,
    }))
    .sort((a, b) => b.students - a.students);
}

export function buildViolationAnalytics(
  violations: { type: string; severity: string; reviewStatus: string }[]
) {
  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  let pending = 0;
  let confirmed = 0;
  let dismissed = 0;

  for (const v of violations) {
    byType[v.type] = (byType[v.type] ?? 0) + 1;
    bySeverity[v.severity] = (bySeverity[v.severity] ?? 0) + 1;
    if (v.reviewStatus === 'pending') pending++;
    else if (v.reviewStatus === 'confirmed') confirmed++;
    else if (v.reviewStatus === 'dismissed') dismissed++;
  }

  return { byType, bySeverity, pending, confirmed, dismissed, total: violations.length };
}

export function attendanceRiskStatus(
  pct: number,
  total: number,
  thresholds: AttendanceThresholds = DEFAULT_ATTENDANCE_THRESHOLDS,
): 'on_track' | 'watch' | 'at_risk' | 'no_data' {
  if (total === 0) return 'no_data';
  if (pct >= thresholds.eligibilityPct) return 'on_track';
  if (pct >= thresholds.condonationPct) return 'watch';
  return 'at_risk';
}

export async function getDepartmentName(departmentId: string): Promise<string | undefined> {
  const dept = await db.department.findUnique({
    where: { id: departmentId },
    select: { name: true },
  });
  return dept?.name;
}
