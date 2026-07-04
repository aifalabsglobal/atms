import { db } from '@/lib/db';
import type { AnchorResourceType } from './anchor-service';

export const AUDIT_ANCHOR_ACTIONS = [
  'session.complete',
  'violation.review',
  'geofence.create',
  'masters.subject.publish',
  'calendar.publish',
  'lms.submission.grade',
] as const;

const AUDIT_ANCHOR_MAP: Record<string, { resourceType: AnchorResourceType; prefix: string }> = {
  'session.complete': { resourceType: 'attendance_session', prefix: 'session:' },
  'violation.review': { resourceType: 'violation_review', prefix: 'violation:' },
  'geofence.create': { resourceType: 'geofence_policy', prefix: 'geofence:' },
  'masters.subject.publish': { resourceType: 'subject_publish', prefix: 'course:' },
  'calendar.publish': { resourceType: 'calendar_event', prefix: 'event:' },
  'lms.submission.grade': { resourceType: 'grade_publish', prefix: 'submission:' },
};

function parseResourceId(resource: string, prefix: string): string | null {
  if (!resource.startsWith(prefix)) return null;
  return resource.slice(prefix.length) || null;
}

export async function enrichAuditLogsWithAnchors<
  T extends { action: string; resource: string },
>(logs: T[]): Promise<Array<T & { anchorHash: string | null }>> {
  const lookups: Array<{ index: number; resourceType: AnchorResourceType; resourceId: string }> = [];

  logs.forEach((log, index) => {
    const mapping = AUDIT_ANCHOR_MAP[log.action];
    if (!mapping) return;
    const resourceId = parseResourceId(log.resource, mapping.prefix);
    if (!resourceId) return;
    lookups.push({ index, resourceType: mapping.resourceType, resourceId });
  });

  if (lookups.length === 0) {
    return logs.map((log) => ({ ...log, anchorHash: null }));
  }

  const anchors = await db.blockchainAnchor.findMany({
    where: {
      OR: lookups.map((l) => ({
        resourceType: l.resourceType,
        resourceId: l.resourceId,
      })),
    },
    select: { resourceType: true, resourceId: true, payloadHash: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  const anchorByKey = new Map<string, string>();
  for (const a of anchors) {
    const key = `${a.resourceType}:${a.resourceId}`;
    if (!anchorByKey.has(key)) {
      anchorByKey.set(key, a.payloadHash);
    }
  }

  return logs.map((log) => {
    const mapping = AUDIT_ANCHOR_MAP[log.action];
    if (!mapping) return { ...log, anchorHash: null };
    const resourceId = parseResourceId(log.resource, mapping.prefix);
    if (!resourceId) return { ...log, anchorHash: null };
    const hash = anchorByKey.get(`${mapping.resourceType}:${resourceId}`) ?? null;
    return { ...log, anchorHash: hash };
  });
}
