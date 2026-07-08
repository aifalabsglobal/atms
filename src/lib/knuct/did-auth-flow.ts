import { db } from '@/lib/db';
import { createKnuctHttpAdapter } from './knuct-client';
import {
  createDIDAuthSession,
  deleteDIDAuthSession,
  getDIDAuthSession,
  saveDIDAuthSession,
} from '@/lib/knuct/did-auth-session';
import { refreshUserKnuctSession } from '@/lib/knuct/knuct-persistent-session';

export async function runDidAuthChallenge(sessionKey: string, hash: string): Promise<string> {
  let adapter = await getDIDAuthSession(sessionKey);
  if (!adapter) {
    adapter = await createDIDAuthSession(sessionKey);
  }
  try {
    const challenge = await adapter.authChallenge(hash);
    await saveDIDAuthSession(sessionKey, adapter);
    return challenge;
  } catch (err) {
    await deleteDIDAuthSession(sessionKey);
    throw err;
  }
}

export async function runDidAuthComplete(
  sessionKey: string,
  response: number[]
): Promise<{ did: string; sessionCookies: Record<string, string> }> {
  const adapter = await getDIDAuthSession(sessionKey);
  if (!adapter) {
    throw new Error('DID auth session expired — please start again');
  }

  try {
    await adapter.authResponse(response);
    await saveDIDAuthSession(sessionKey, adapter);
    await adapter.startNode();
    await saveDIDAuthSession(sessionKey, adapter);
    const walletData = await adapter.walletData();
    const sessionCookies = adapter.exportCookies();
    return { did: walletData.did, sessionCookies };
  } finally {
    await deleteDIDAuthSession(sessionKey);
  }
}

/** Persist Knuct session cookies for a user and optionally fetch CAPI account info. */
export async function persistKnuctSessionForUser(
  userId: string,
  sessionCookies: Record<string, string>
): Promise<{ accountInfo?: unknown }> {
  const adapter = createKnuctHttpAdapter();
  adapter.loadCookies(sessionCookies);
  await refreshUserKnuctSession(userId, adapter);
  try {
    const accountInfo = await adapter.capiGetAccountInfo();
    await refreshUserKnuctSession(userId, adapter);
    return { accountInfo };
  } catch (err) {
    console.warn('[knuct] getAccountInfo after auth failed (non-fatal):', err);
    return {};
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
