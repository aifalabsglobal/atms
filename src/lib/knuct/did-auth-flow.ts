import { db } from '@/lib/db';
import {
  createDIDAuthSession,
  deleteDIDAuthSession,
  getDIDAuthSession,
} from '@/lib/knuct/did-auth-session';

export async function runDidAuthChallenge(sessionKey: string, hash: string): Promise<string> {
  const adapter = createDIDAuthSession(sessionKey);
  try {
    return await adapter.authChallenge(hash);
  } catch (err) {
    deleteDIDAuthSession(sessionKey);
    throw err;
  }
}

export async function runDidAuthComplete(sessionKey: string, response: number[]): Promise<string> {
  const adapter = getDIDAuthSession(sessionKey);
  if (!adapter) {
    throw new Error('DID auth session expired — please start again');
  }

  try {
    await adapter.authResponse(response);
    await adapter.startNode();
    const walletData = await adapter.walletData();
    return walletData.did;
  } finally {
    deleteDIDAuthSession(sessionKey);
  }
}

export async function persistVerifiedDid(userId: string, did: string): Promise<void> {
  await db.knuctWallet.upsert({
    where: { userId },
    create: {
      userId,
      did,
      status: 'active',
    },
    update: {
      did,
      status: 'active',
      lastError: null,
    },
  });
}

export async function findActiveUserByDid(did: string) {
  const wallet = await db.knuctWallet.findFirst({
    where: { did, status: 'active' },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          department: true,
          profileImageUrl: true,
          linkedStudentId: true,
          status: true,
        },
      },
    },
  });

  if (!wallet?.user || wallet.user.status !== 'active') {
    return null;
  }

  return wallet.user;
}
