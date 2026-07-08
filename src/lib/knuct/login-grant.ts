import { randomBytes } from 'crypto';
import { knuctKvDel, knuctKvGet, knuctKvSet } from './redis-store';

const TTL_SEC = 2 * 60;
const KEY_PREFIX = 'knuct:login-grant:';

interface Grant {
  userId: string;
}

export async function createKnuctLoginGrant(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const payload: Grant = { userId };
  await knuctKvSet(`${KEY_PREFIX}${token}`, JSON.stringify(payload), TTL_SEC);
  return token;
}

export async function consumeKnuctLoginGrant(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const raw = await knuctKvGet(`${KEY_PREFIX}${token}`);
  await knuctKvDel(`${KEY_PREFIX}${token}`);
  if (!raw) return null;
  try {
    const grant = JSON.parse(raw) as Grant;
    return grant.userId ?? null;
  } catch {
    return null;
  }
}

export async function purgeExpiredKnuctLoginGrants(): Promise<void> {
  /* TTL handled by redis-store */
}
