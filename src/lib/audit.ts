import { db } from '@/lib/db';
import { isAuditLoggingEnabledSync } from '@/lib/system-config';

export type AuditAction =
  | 'login'
  | 'user.create'
  | 'user.update'
  | 'user.reset_password'
  | 'violation.review'
  | 'geofence.create'
  | 'session.create'
  | 'attendance.mark';

export async function logAudit(params: {
  userId?: string | null;
  action: AuditAction | string;
  resource: string;
  details?: Record<string, unknown> | string;
  ipAddress?: string | null;
}) {
  if (!isAuditLoggingEnabledSync()) return;

  try {
    await db.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        resource: params.resource,
        details:
          typeof params.details === 'string'
            ? params.details
            : params.details
              ? JSON.stringify(params.details)
              : null,
        ipAddress: params.ipAddress ?? null,
      },
    });
  } catch (err) {
    console.error('[audit] failed to write log:', err);
  }
}

export function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? null;
  return request.headers.get('x-real-ip');
}
