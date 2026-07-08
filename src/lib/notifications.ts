import { db } from '@/lib/db';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export async function createInAppNotification(params: {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string | null;
}) {
  try {
    await db.notification.create({
      data: {
        userId: params.userId,
        title: params.title,
        message: params.message,
        type: params.type ?? 'info',
        channel: 'in_app',
        link: params.link ?? null,
      },
    });
  } catch (err) {
    console.error('[notifications] failed to create:', err);
  }
}

export async function notifyRegistrationApproved(userId: string, role: string) {
  await createInAppNotification({
    userId,
    title: 'Registration approved',
    message: `Your AIMSCS account is active as ${role.replace('_', ' ')}. Sign in with Knuct DID or your assigned credentials.`,
    type: 'success',
    link: '/login',
  });
}

export async function notifyWalletProvisionResolved(
  userId: string,
  approved: boolean,
  requestType: string,
) {
  await createInAppNotification({
    userId,
    title: approved ? 'Knuct wallet request approved' : 'Knuct wallet request rejected',
    message: approved
      ? `Your ${requestType === 'reprovision' ? 'wallet re-provision' : 'wallet creation'} request was approved. Open My Knuct Wallet on the dashboard.`
      : `Your wallet ${requestType} request was rejected. Contact an administrator if you need help.`,
    type: approved ? 'success' : 'warning',
  });
}

export async function notifyViolationCreated(studentId: string, violationType: string, courseCode?: string) {
  await createInAppNotification({
    userId: studentId,
    title: 'Attendance review required',
    message: courseCode
      ? `A ${violationType.replace(/_/g, ' ')} flag was raised for ${courseCode}. Check Violations or contact faculty.`
      : `An attendance integrity flag (${violationType.replace(/_/g, ' ')}) was raised on your record.`,
    type: 'warning',
  });
}
