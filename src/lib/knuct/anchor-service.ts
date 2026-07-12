import { createHash } from 'crypto';
import { db } from '@/lib/db';
import { enqueueKnuctJob } from './job-queue';
import { enqueueChainPublish, isChainPublishEnabled } from './chain-publish';
import { getSystemConfig } from '@/lib/system-config';

export type AnchorResourceType =
  | 'attendance_session'
  | 'violation_review'
  | 'grade_publish'
  | 'geofence_policy'
  | 'calendar_event'
  | 'subject_publish'
  | 'condonation_decision';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export function hashPayload(payload: Record<string, unknown>): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

export async function isAnchorEnabled(): Promise<boolean> {
  if (process.env.KNUCT_ANCHOR_ENABLED === 'false') return false;
  const cfg = await getSystemConfig();
  return cfg.policies.knuctAnchorsEnabled;
}

/** Hash anchor in PostgreSQL; optional async Knuct chain publish when vendor API is configured. */
export async function anchorResource(
  resourceType: AnchorResourceType,
  resourceId: string,
  payload: Record<string, unknown>
): Promise<{ id: string; payloadHash: string } | null> {
  if (!(await isAnchorEnabled())) return null;

  try {
    const payloadHash = hashPayload({ resourceType, resourceId, ...payload });
    const chainPending = isChainPublishEnabled();

    const existing = await db.blockchainAnchor.findFirst({
      where: { resourceType, resourceId, payloadHash },
      select: { id: true, payloadHash: true, knuctTxRef: true },
    });
    if (existing) {
      if (chainPending && !existing.knuctTxRef) {
        enqueueChainPublish(existing.id, { resourceType, resourceId, payloadHash });
      }
      return { id: existing.id, payloadHash: existing.payloadHash };
    }

    const anchor = await db.blockchainAnchor.create({
      data: {
        resourceType,
        resourceId,
        payloadHash,
        status: chainPending ? 'pending' : 'anchored',
        knuctTxRef: null,
      },
      select: { id: true, payloadHash: true },
    });

    console.info('[knuct] anchor recorded', {
      resourceType,
      resourceId,
      payloadHash: payloadHash.slice(0, 12),
      chainPending,
    });

    if (chainPending) {
      enqueueChainPublish(anchor.id, { resourceType, resourceId, payloadHash });
    }

    return anchor;
  } catch (err) {
    console.error('[knuct] anchor failed', { resourceType, resourceId, err });
    return null;
  }
}

export function enqueueAnchor(
  resourceType: AnchorResourceType,
  resourceId: string,
  payload: Record<string, unknown>
): void {
  enqueueKnuctJob(async () => {
    await anchorResource(resourceType, resourceId, payload);
  });
}
