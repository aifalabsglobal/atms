import type { KnuctConfig } from './types';

export function getKnuctConfig(): KnuctConfig {
  return {
    enabled: process.env.KNUCT_ENABLED === 'true',
    baseUrl: (process.env.KNUCT_BASE_URL ?? 'https://webwallet.knuct.com').replace(/\/$/, ''),
    walletOnUserCreate: process.env.KNUCT_WALLET_ON_USER_CREATE === 'true',
    maxRetries: Math.max(0, parseInt(process.env.KNUCT_MAX_RETRIES ?? '2', 10) || 0),
    circuitBreakerThreshold: Math.max(
      1,
      parseInt(process.env.KNUCT_CIRCUIT_BREAKER_THRESHOLD ?? '5', 10) || 5
    ),
  };
}

export function isKnuctLiveEnabled(): boolean {
  return getKnuctConfig().enabled;
}
