import { db } from '@/lib/db';
import { getSystemConfig } from '@/lib/system-config';
import { createInAppNotification } from '@/lib/notifications';

const LOW_ATTENDANCE_TITLE = 'Low attendance warning';
const DEDUPE_DAYS = 7;

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

async function hasRecentNotification(userId: string, title: string): Promise<boolean> {
  const existing = await db.notification.findFirst({
    where: {
      userId,
      title,
      createdAt: { gte: daysAgo(DEDUPE_DAYS) },
    },
    select: { id: true },
  });
  return !!existing;
}

async function getStudentAttendancePct(studentId: string): Promise<{ pct: number; total: number }> {
  const grouped = await db.attendanceRecord.groupBy({
    by: ['status'],
    where: { studentId },
    _count: { _all: true },
  });
  let present = 0;
  let total = 0;
  for (const row of grouped) {
    const n = row._count._all;
    total += n;
    if (row.status === 'present' || row.status === 'late') present += n;
  }
  const pct = total > 0 ? Math.round((present / total) * 100) : 100;
  return { pct, total };
}

async function notifyLinkedParents(studentId: string, title: string, message: string) {
  const parents = await db.user.findMany({
    where: { linkedStudentId: studentId, status: 'active' },
    select: { id: true },
  });
  await Promise.all(
    parents.map((p) =>
      createInAppNotification({ userId: p.id, title, message, type: 'warning' }),
    ),
  );
}

/** After a successful mark, warn student (and linked parents) if below eligibility threshold. */
export async function maybeNotifyLowAttendance(studentId: string): Promise<void> {
  const config = await getSystemConfig();
  if (!config.notifications.lowAttendanceWarningEnabled) return;

  const { pct, total } = await getStudentAttendancePct(studentId);
  if (total < 3 || pct >= config.attendance.eligibilityPct) return;

  if (await hasRecentNotification(studentId, LOW_ATTENDANCE_TITLE)) return;

  const message = `Your attendance is ${pct}% (${total} sessions recorded), below the ${config.attendance.eligibilityPct}% minimum. Contact faculty or HOD if you need support.`;

  await createInAppNotification({
    userId: studentId,
    title: LOW_ATTENDANCE_TITLE,
    message,
    type: 'warning',
    link: '/',
  });

  await notifyLinkedParents(studentId, LOW_ATTENDANCE_TITLE, message);

  if (config.notifications.lowAttendanceEmailEnabled) {
    const student = await db.user.findUnique({
      where: { id: studentId },
      select: { email: true, name: true, phone: true },
    });
    if (student?.email) {
      const { sendLowAttendanceEmail } = await import('@/lib/email');
      await sendLowAttendanceEmail(student.email, student.name, pct, config.attendance.eligibilityPct);
    }
  }

  const { getGlobalBoolean } = await import('@/lib/settings');
  const smsEnabled = await getGlobalBoolean('notifications.low_attendance_sms', false);
  if (smsEnabled) {
    const student = await db.user.findUnique({
      where: { id: studentId },
      select: { phone: true, name: true },
    });
    if (student?.phone) {
      const { sendSms } = await import('@/lib/sms');
      await sendSms(
        student.phone,
        `AIMSCS: attendance ${pct}% is below the ${config.attendance.eligibilityPct}% minimum. Check the app for details.`,
      );
    }
  }
}

/** Notify student when a self-mark attempt fails integrity checks (no DB violation record). */
export async function notifyAttendanceIntegrityIssue(params: {
  studentId: string;
  issueType: 'out_of_geofence' | 'face_mismatch' | 'geofence_required';
  courseCode?: string;
  detail?: string;
}): Promise<void> {
  const config = await getSystemConfig();
  if (!config.notifications.violationAlertEnabled) return;

  const title = 'Attendance mark not accepted';
  const base =
    params.issueType === 'out_of_geofence'
      ? 'You were outside the required campus zone.'
      : params.issueType === 'face_mismatch'
        ? 'Face verification did not match your profile photo.'
        : 'This session requires location verification.';

  const message = params.courseCode
    ? `${base} Course: ${params.courseCode}.${params.detail ? ` ${params.detail}` : ''}`
    : `${base}${params.detail ? ` ${params.detail}` : ''}`;

  if (await hasRecentNotification(params.studentId, title)) return;

  await createInAppNotification({
    userId: params.studentId,
    title,
    message,
    type: 'warning',
  });

  await notifyLinkedParents(params.studentId, title, message);
}
