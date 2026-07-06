import { db } from '@/lib/db';
import { getKnuctConfig } from './config';
import { knuctVendorPost } from './vendor-http';
import { enqueueKnuctJob } from './job-queue';

export function isChainPublishEnabled(): boolean {
  return (
    getKnuctConfig().enabled &&
    process.env.KNUCT_CHAIN_PUBLISH_ENABLED === 'true' &&
    Boolean(process.env.KNUCT_CHAIN_PUBLISH_URL?.trim())
  );
}

export type ChainPublishResult = {
  published: boolean;
  txRef: string | null;
  error?: string;
};

/**
 * Publish a hash anchor to Knuct when vendor chain API is configured.
 * Falls back gracefully — PostgreSQL hash remains the system of record.
 */
export async function publishAnchorToChain(
  anchorId: string,
  payload: {
    resourceType: string;
    resourceId: string;
    payloadHash: string;
  }
): Promise<ChainPublishResult> {
  if (!isChainPublishEnabled()) {
    return { published: false, txRef: null };
  }

  const url = process.env.KNUCT_CHAIN_PUBLISH_URL!.trim();
  const res = await knuctVendorPost<{
    txRef?: string;
    txHash?: string;
    transactionId?: string;
    id?: string;
  }>(url, {
    resourceType: payload.resourceType,
    resourceId: payload.resourceId,
    payloadHash: payload.payloadHash,
    tenantId: getKnuctConfig().tenantId ?? undefined,
  });

  if (!res.ok) {
    await db.blockchainAnchor.update({
      where: { id: anchorId },
      data: {
        status: 'failed',
        lastError: res.error ?? `HTTP ${res.status}`,
      },
    });
    console.warn('[knuct] chain publish failed', { anchorId, error: res.error });
    return { published: false, txRef: null, error: res.error };
  }

  const txRef =
    res.data?.txRef ?? res.data?.txHash ?? res.data?.transactionId ?? res.data?.id ?? null;

  await db.blockchainAnchor.update({
    where: { id: anchorId },
    data: {
      status: 'anchored',
      knuctTxRef: txRef,
      lastError: null,
    },
  });

  console.info('[knuct] chain publish ok', { anchorId, txRef: txRef?.slice(0, 16) });
  return { published: true, txRef };
}

export function enqueueChainPublish(
  anchorId: string,
  payload: { resourceType: string; resourceId: string; payloadHash: string }
): void {
  enqueueKnuctJob(async () => {
    await publishAnchorToChain(anchorId, payload);
  });
}
