import { db } from '@/lib/db';
import { hashPayload } from './anchor-service';
import { getKnuctConfig } from './config';
import { mintCredentialOnKnuct, isCredentialMintConfigured } from './credential-client';
import { enqueueKnuctJob } from './job-queue';

export type CredentialType = 'attendance_certificate' | 'grade_transcript' | 'compliance_report';

export function isCredentialEnabled(): boolean {
  return getKnuctConfig().enabled && process.env.KNUCT_CREDENTIALS_ENABLED === 'true';
}

export async function issueCredential(
  userId: string,
  type: CredentialType,
  payload: Record<string, unknown>,
  resourceId?: string
): Promise<{ id: string; status: string; payloadHash: string; verifyUrl?: string | null }> {
  const payloadHash = hashPayload({ type, userId, resourceId, ...payload });

  const existing = await db.knuctCredential.findFirst({
    where: { userId, type, payloadHash, status: 'issued' },
    select: { id: true, status: true, payloadHash: true, verifyUrl: true },
  });
  if (existing) return existing;

  const record = await db.knuctCredential.create({
    data: {
      userId,
      type,
      resourceId: resourceId ?? null,
      payloadHash,
      status: isCredentialMintConfigured() ? 'pending' : 'unavailable',
      metadata: JSON.stringify({ issuedBy: 'scms', at: new Date().toISOString() }),
    },
    select: { id: true, status: true, payloadHash: true },
  });

  if (!isCredentialEnabled()) {
    return { ...record, status: 'unavailable' };
  }

  if (!isCredentialMintConfigured()) {
    console.warn('[knuct] credential stored hash-only — set KNUCT_CREDENTIAL_MINT_URL when vendor API is ready');
    return { ...record, status: 'unavailable' };
  }

  enqueueKnuctJob(async () => {
    await finalizeCredentialIssue(record.id, userId, type, payloadHash, resourceId, payload);
  });

  return { ...record, status: 'pending' };
}

async function finalizeCredentialIssue(
  credentialId: string,
  userId: string,
  type: CredentialType,
  payloadHash: string,
  resourceId: string | undefined,
  payload: Record<string, unknown>
) {
  const wallet = await db.knuctWallet.findUnique({
    where: { userId },
    select: { did: true },
  });

  const mint = await mintCredentialOnKnuct({
    userId,
    userDid: wallet?.did,
    type,
    payloadHash,
    resourceId,
    metadata: payload,
  });

  if (!mint.issued) {
    await db.knuctCredential.update({
      where: { id: credentialId },
      data: { status: 'failed', lastError: mint.error ?? 'Mint failed' },
    });
    return;
  }

  await db.knuctCredential.update({
    where: { id: credentialId },
    data: {
      status: 'issued',
      knuctAssetRef: mint.assetRef,
      verifyUrl: mint.verifyUrl,
      lastError: null,
    },
  });
}

export async function getCredentialStats() {
  const sinceDay = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sinceWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [today, week, failed, byTypeRows] = await Promise.all([
    db.knuctCredential.count({ where: { createdAt: { gte: sinceDay }, status: 'issued' } }),
    db.knuctCredential.count({ where: { createdAt: { gte: sinceWeek }, status: 'issued' } }),
    db.knuctCredential.count({ where: { status: 'failed' } }),
    db.knuctCredential.groupBy({
      by: ['type'],
      where: { status: 'issued' },
      _count: true,
    }),
  ]);

  const byType = Object.fromEntries(byTypeRows.map((r) => [r.type, r._count]));
  return { today, week, failed, byType };
}

export async function getUserCredentials(userId: string) {
  return db.knuctCredential.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      type: true,
      resourceId: true,
      payloadHash: true,
      knuctAssetRef: true,
      verifyUrl: true,
      status: true,
      createdAt: true,
    },
  });
}
