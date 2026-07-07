import { randomBytes } from 'crypto';

const TTL_MS = 2 * 60 * 1000;

interface Grant {
  userId: string;
  expiresAt: number;
}

const grants = new Map<string, Grant>();

export function createKnuctLoginGrant(userId: string): string {
  purgeExpiredKnuctLoginGrants();
  const token = randomBytes(32).toString('hex');
  grants.set(token, { userId, expiresAt: Date.now() + TTL_MS });
  return token;
}

export function consumeKnuctLoginGrant(token: string | undefined | null): string | null {
  if (!token) return null;
  purgeExpiredKnuctLoginGrants();
  const grant = grants.get(token);
  if (!grant || Date.now() > grant.expiresAt) {
    grants.delete(token);
    return null;
  }
  grants.delete(token);
  return grant.userId;
}

export function purgeExpiredKnuctLoginGrants(): void {
  const now = Date.now();
  for (const [key, grant] of grants.entries()) {
    if (now > grant.expiresAt) grants.delete(key);
  }
}
