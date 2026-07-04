import { db } from '@/lib/db';
import { getKnuctConfig, isKnuctLiveEnabled } from './config';
import { getKnuctCircuitState, isKnuctCircuitOpen } from './circuit-breaker';
import { MockKnuctAdapter } from './mock-adapter';
import { KnuctHttpAdapter } from './knuct-client';
import type { KnuctAdapter, KnuctDashboardStats } from './types';

export function getKnuctAdapter(): KnuctAdapter {
  const config = getKnuctConfig();
  if (config.enabled && !isKnuctCircuitOpen()) {
    return new KnuctHttpAdapter(config.baseUrl);
  }
  return new MockKnuctAdapter();
}

export async function getKnuctHealth(): Promise<{
  enabled: boolean;
  adapterMode: 'mock' | 'live';
  health: 'ok' | 'degraded' | 'down';
  circuitBreakerOpen: boolean;
  consecutiveFailures: number;
}> {
  const config = getKnuctConfig();
  const circuit = getKnuctCircuitState();
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

  try {
    const adapter = new KnuctHttpAdapter(config.baseUrl);
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
  const health = await getKnuctHealth();
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

  return {
    enabled: isKnuctLiveEnabled(),
    adapterMode: health.adapterMode,
    health: health.health,
    circuitBreakerOpen: health.circuitBreakerOpen,
    wallets: { total, active, failed, pending },
    didCoveragePct,
    credentials: { today: 0, week: 0, failed: 0, byType: {} },
    anchors: { today: anchorsToday, byModule },
    recentActivity: recentAnchors.map((a) => ({
      type: 'anchor' as const,
      module: a.resourceType,
      ref: a.payloadHash.slice(0, 16),
      at: a.createdAt.toISOString(),
    })),
  };
}

export async function getUserKnuctWallet(userId: string) {
  return db.knuctWallet.findUnique({
    where: { userId },
    select: {
      id: true,
      did: true,
      status: true,
      lastError: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}
