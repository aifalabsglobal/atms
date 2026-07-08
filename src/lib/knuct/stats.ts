import { db } from '@/lib/db';
import { getKnuctConfig, isKnuctLiveEnabled } from './config';
import { getKnuctCircuitState, isKnuctCircuitOpen } from './circuit-breaker';
import { MockKnuctAdapter } from './mock-adapter';
import { createKnuctHttpAdapter } from './knuct-client';
import { getCredentialStats } from './credential-service';
import type { KnuctAdapter, KnuctDashboardStats } from './types';

export function getKnuctAdapter(): KnuctAdapter {
  const config = getKnuctConfig();
  if (config.enabled && !isKnuctCircuitOpen()) {
    return createKnuctHttpAdapter(config.baseUrl);
  }
  return new MockKnuctAdapter();
}

export type KnuctHealthSnapshot = {
  enabled: boolean;
  adapterMode: 'mock' | 'live';
  health: 'ok' | 'degraded' | 'down' | 'unknown';
  circuitBreakerOpen: boolean;
  consecutiveFailures: number;
};

function knuctHealthFromConfig(circuit = getKnuctCircuitState()): KnuctHealthSnapshot {
  const config = getKnuctConfig();
  const adapterMode = config.enabled && !circuit.open ? 'live' : 'mock';

  if (circuit.open) {
    return {
      enabled: config.enabled,
      adapterMode,
      health: 'down',
      circuitBreakerOpen: true,
      consecutiveFailures: circuit.consecutiveFailures,
    };
  }

  if (!config.enabled) {
    return {
      enabled: false,
      adapterMode: 'mock',
      health: 'ok',
      circuitBreakerOpen: false,
      consecutiveFailures: 0,
    };
  }

  return {
    enabled: true,
    adapterMode: 'live',
    health: 'unknown',
    circuitBreakerOpen: false,
    consecutiveFailures: 0,
  };
}

/** Status reads use config-only health; pass `{ ping: true }` for live vendor reachability checks. */
export async function getKnuctHealth(opts?: { ping?: boolean }): Promise<KnuctHealthSnapshot> {
  const config = getKnuctConfig();
  const circuit = getKnuctCircuitState();

  if (!opts?.ping) {
    return knuctHealthFromConfig(circuit);
  }

  if (circuit.open) {
    return knuctHealthFromConfig(circuit);
  }

  if (!config.enabled) {
    return knuctHealthFromConfig(circuit);
  }

  try {
    const adapter = createKnuctHttpAdapter(config.baseUrl);
    const started = Date.now();
    await adapter.startTempNode();
    console.info('[knuct] health ping ok', { ms: Date.now() - started });
    return {
      enabled: true,
      adapterMode: 'live',
      health: 'ok',
      circuitBreakerOpen: false,
      consecutiveFailures: 0,
    };
  } catch {
    return {
      enabled: true,
      adapterMode: 'live',
      health: 'degraded',
      circuitBreakerOpen: isKnuctCircuitOpen(),
      consecutiveFailures: getKnuctCircuitState().consecutiveFailures,
    };
  }
}

export async function getKnuctDashboardStats(): Promise<KnuctDashboardStats> {
  const health = knuctHealthFromConfig();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [total, active, failed, pending, userCount, anchorsToday, anchorGroups, recentAnchors] =
    await Promise.all([
      db.knuctWallet.count(),
      db.knuctWallet.count({ where: { status: 'active' } }),
      db.knuctWallet.count({ where: { status: 'failed' } }),
      db.knuctWallet.count({ where: { status: 'pending' } }),
      db.user.count({ where: { status: 'active' } }),
      db.blockchainAnchor.count({ where: { createdAt: { gte: startOfDay } } }),
      db.blockchainAnchor.groupBy({
        by: ['resourceType'],
        where: { createdAt: { gte: startOfDay } },
        _count: true,
      }),
      db.blockchainAnchor.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { resourceType: true, resourceId: true, payloadHash: true, createdAt: true },
      }),
    ]);

  const didCoveragePct = userCount > 0 ? Math.round((active / userCount) * 100) : 0;
  const byModule = Object.fromEntries(anchorGroups.map((g) => [g.resourceType, g._count]));
  const credentials = await getCredentialStats();

  return {
    enabled: isKnuctLiveEnabled(),
    adapterMode: health.adapterMode,
    health: health.health,
    circuitBreakerOpen: health.circuitBreakerOpen,
    wallets: { total, active, failed, pending },
    didCoveragePct,
    credentials,
    anchors: { today: anchorsToday, byModule },
    recentActivity: recentAnchors.map((a) => ({
      type: 'anchor' as const,
      module: a.resourceType,
      ref: a.payloadHash.slice(0, 16),
      hash: a.payloadHash,
      at: a.createdAt.toISOString(),
    })),
  };
}

export async function getUserKnuctWallet(userId: string) {
  const row = await db.knuctWallet.findUnique({
    where: { userId },
    select: {
      id: true,
      did: true,
      status: true,
      lastError: true,
      createdAt: true,
      updatedAt: true,
      privShareEnc: true,
    },
  });
  if (!row) return null;
  const { privShareEnc, ...wallet } = row;
  return {
    ...wallet,
    hasPrivShare: privShareEnc != null && privShareEnc.length > 0,
  };
}
