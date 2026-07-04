import { db } from '@/lib/db';
import { getKnuctConfig } from './config';
import { resetKnuctCircuit } from './circuit-breaker';
import { enqueueWalletProvision, provisionWallet } from './wallet-service';

export type PilotProvisionResult = {
  userId: string;
  email: string;
  status: 'queued' | 'active' | 'skipped' | 'failed';
  reason?: string;
};

const DEFAULT_PILOT_EMAILS = [
  'registrar@jntuh.ac.in',
  'hod.cse@jntuh.ac.in',
  'faculty.venkat@jntuh.ac.in',
  'student.ravi@jntuh.ac.in',
  'student.priya@jntuh.ac.in',
];

export async function resolvePilotUserIds(opts: {
  userIds?: string[];
  emails?: string[];
  roles?: string[];
  limit?: number;
}): Promise<string[]> {
  const config = getKnuctConfig();
  const limit = Math.min(opts.limit ?? config.pilotCohortLimit, config.pilotCohortLimit);

  if (opts.userIds?.length) {
    return opts.userIds.slice(0, limit);
  }

  const emails = opts.emails?.length ? opts.emails : DEFAULT_PILOT_EMAILS;
  const byEmail = await db.user.findMany({
    where: { email: { in: emails.map((e) => e.toLowerCase()) }, status: 'active' },
    select: { id: true },
    take: limit,
  });
  if (byEmail.length > 0) {
    return byEmail.map((u) => u.id);
  }

  if (opts.roles?.length) {
    const byRole = await db.user.findMany({
      where: { role: { in: opts.roles }, status: 'active' },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return byRole.map((u) => u.id);
  }

  const fallback = await db.user.findMany({
    where: { status: 'active' },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
  return fallback.map((u) => u.id);
}

/** Queue live wallet provisioning for a bounded pilot cohort. */
export async function startPilotProvisioning(opts: {
  userIds?: string[];
  emails?: string[];
  roles?: string[];
  limit?: number;
  sync?: boolean;
}): Promise<{ mode: 'live' | 'mock'; results: PilotProvisionResult[] }> {
  const config = getKnuctConfig();
  if (!config.enabled) {
    throw new Error('Set KNUCT_ENABLED=true to run the live pilot');
  }

  resetKnuctCircuit();

  const ids = await resolvePilotUserIds(opts);
  const users = await db.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, email: true, knuctWallet: { select: { status: true } } },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const results: PilotProvisionResult[] = [];

  for (const userId of ids) {
    const user = userMap.get(userId);
    if (!user) {
      results.push({ userId, email: 'unknown', status: 'failed', reason: 'User not found' });
      continue;
    }
    if (user.knuctWallet?.status === 'active') {
      results.push({ userId, email: user.email, status: 'skipped', reason: 'Wallet already active' });
      continue;
    }

    if (opts.sync) {
      try {
        await provisionWallet(userId);
        const w = await db.knuctWallet.findUnique({
          where: { userId },
          select: { status: true, lastError: true },
        });
        results.push({
          userId,
          email: user.email,
          status: w?.status === 'active' ? 'active' : 'failed',
          reason: w?.status === 'active' ? undefined : w?.lastError ?? w?.status ?? 'Provisioning failed',
        });
      } catch (err) {
        results.push({
          userId,
          email: user.email,
          status: 'failed',
          reason: err instanceof Error ? err.message : 'Provisioning failed',
        });
      }
    } else {
      enqueueWalletProvision(userId);
      results.push({ userId, email: user.email, status: 'queued' });
    }
  }

  return { mode: 'live', results };
}
