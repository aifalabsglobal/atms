import { createHash } from 'crypto';
import { db } from '@/lib/db';

export type AnchorResourceType = 'attendance_session' | 'violation_review' | 'grade_publish';

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

export function isAnchorEnabled(): boolean {
  return process.env.KNUCT_ANCHOR_ENABLED !== 'false';
}

/** Hash-only anchor stored in PostgreSQL; Knuct chain publish deferred until vendor API exists. */
export async function anchorResource(
  resourceType: AnchorResourceType,
  resourceId: string,
  payload: Record<string, unknown>
): Promise<{ id: string; payloadHash: string } | null> {
  if (!isAnchorEnabled()) return null;

  try {
    const payloadHash = hashPayload({ resourceType, resourceId, ...payload });

    const existing = await db.blockchainAnchor.findFirst({
      where: { resourceType, resourceId, payloadHash },
      select: { id: true, payloadHash: true },
    });
    if (existing) return existing;

    const anchor = await db.blockchainAnchor.create({
      data: {
        resourceType,
        resourceId,
        payloadHash,
        status: 'anchored',
        knuctTxRef: null,
      },
      select: { id: true, payloadHash: true },
    });

    console.info('[knuct] anchor recorded', { resourceType, resourceId, payloadHash: payloadHash.slice(0, 12) });
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
  setImmediate(() => {
    anchorResource(resourceType, resourceId, payload).catch((err) => {
      console.error('[knuct] enqueue anchor failed', { resourceType, resourceId, err });
    });
  });
}
