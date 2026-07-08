import { randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { enqueueKnuctJob } from './job-queue';
import { getUserKnuctWallet } from './stats';
import { provisionWallet } from './wallet-service';

export type WalletProvisionRequestType = 'create' | 'reprovision';
export type WalletProvisionRequestStatus = 'pending' | 'approved' | 'rejected';

export function isWalletProvisionerRole(role: string): boolean {
  return role === 'super_admin' || role === 'admin';
}

export async function getPendingWalletProvisionRequest(userId: string) {
  return db.knuctWalletProvisionRequest.findFirst({
    where: { userId, status: 'pending' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      requestType: true,
      status: true,
      userNote: true,
      createdAt: true,
    },
  });
}

export async function listWalletProvisionRequests(status = 'pending') {
  return db.knuctWalletProvisionRequest.findMany({
    where: { status },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          department: true,
          knuctWallet: { select: { status: true, did: true } },
        },
      },
    },
  });
}

export async function createWalletProvisionRequest(params: {
  userId: string;
  requestType: WalletProvisionRequestType;
  userNote?: string;
}) {
  const wallet = await getUserKnuctWallet(params.userId);
  const hasActiveWallet = wallet?.status === 'active';

  if (params.requestType === 'create' && hasActiveWallet) {
    throw new Error('You already have an active Knuct wallet.');
  }
  if (params.requestType === 'reprovision' && !hasActiveWallet) {
    throw new Error('Request wallet creation first — no active wallet to re-provision.');
  }

  const existing = await getPendingWalletProvisionRequest(params.userId);
  if (existing) {
    throw new Error('You already have a pending wallet request awaiting admin approval.');
  }

  return db.knuctWalletProvisionRequest.create({
    data: {
      userId: params.userId,
      requestType: params.requestType,
      userNote: params.userNote?.trim() || null,
      status: 'pending',
    },
  });
}

export async function approveWalletProvisionRequest(params: {
  requestId: string;
  reviewerId: string;
}) {
  const request = await db.knuctWalletProvisionRequest.findUnique({
    where: { id: params.requestId },
    include: { user: { select: { id: true, email: true, name: true, role: true } } },
  });

  if (!request || request.status !== 'pending') {
    throw new Error('Wallet provision request not found or already reviewed.');
  }

  await db.knuctWalletProvisionRequest.update({
    where: { id: request.id },
    data: {
      status: 'approved',
      reviewedById: params.reviewerId,
      reviewedAt: new Date(),
    },
  });

  await enqueueKnuctJob(() => provisionWallet(request.userId));

  await logAudit({
    userId: params.reviewerId,
    action: 'knuct.wallet_provision.approve',
    resource: `knuct-wallet-request:${request.id}`,
    details: {
      targetUserId: request.userId,
      email: request.user.email,
      requestType: request.requestType,
    },
  });

  const { notifyWalletProvisionResolved } = await import('@/lib/notifications');
  await notifyWalletProvisionResolved(request.userId, true, request.requestType);

  return request;
}

export async function rejectWalletProvisionRequest(params: {
  requestId: string;
  reviewerId: string;
  reason?: string;
}) {
  const request = await db.knuctWalletProvisionRequest.findUnique({ where: { id: params.requestId } });
  if (!request || request.status !== 'pending') {
    throw new Error('Wallet provision request not found or already reviewed.');
  }

  await db.knuctWalletProvisionRequest.update({
    where: { id: request.id },
    data: {
      status: 'rejected',
      reviewedById: params.reviewerId,
      reviewedAt: new Date(),
      rejectionReason: params.reason?.trim() || 'Rejected by administrator',
    },
  });

  await logAudit({
    userId: params.reviewerId,
    action: 'knuct.wallet_provision.reject',
    resource: `knuct-wallet-request:${request.id}`,
    details: {
      targetUserId: request.userId,
      requestType: request.requestType,
    },
  });

  const { notifyWalletProvisionResolved } = await import('@/lib/notifications');
  await notifyWalletProvisionResolved(request.userId, false, request.requestType);
}

/** Queue wallet creation when admin creates a user (requires separate approval). */
export async function queueWalletProvisionRequestOnUserCreate(userId: string): Promise<void> {
  const existing = await getPendingWalletProvisionRequest(userId);
  if (existing) return;

  await db.knuctWalletProvisionRequest.create({
    data: {
      userId,
      requestType: 'create',
      userNote: 'Auto-requested when user account was created',
      status: 'pending',
    },
  });
}

export function placeholderRegistrationDid(): string {
  return `pending:${randomBytes(12).toString('hex')}`;
}
