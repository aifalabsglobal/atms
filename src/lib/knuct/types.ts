export interface KnuctWalletResult {
  did: string;
  privShareUrl: string;
}

export interface KnuctPrivShare {
  raw: Buffer;
  fetchedAt: Date;
}

export interface KnuctAdapter {
  startTempNode(): Promise<void>;
  createWallet(
    passphrase: string,
    seedWords: [string, string, string, string]
  ): Promise<KnuctWalletResult>;
  fetchPrivateShare(privShareUrl: string): Promise<KnuctPrivShare>;
}

export interface KnuctConfig {
  enabled: boolean;
  baseUrl: string;
  walletOnUserCreate: boolean;
  maxRetries: number;
  circuitBreakerThreshold: number;
}

export interface KnuctDashboardStats {
  enabled: boolean;
  adapterMode: 'mock' | 'live';
  health: 'ok' | 'degraded' | 'down';
  circuitBreakerOpen: boolean;
  wallets: { total: number; active: number; failed: number; pending: number };
  didCoveragePct: number;
  credentials: { today: number; week: number; failed: number; byType: Record<string, number> };
  anchors: { today: number; byModule: Record<string, number> };
  recentActivity: Array<{
    type: 'anchor' | 'credential';
    module: string;
    ref: string;
    at: string;
  }>;
}

export const KNUCT_SEED_WORDS = [
  'Hill', 'Bull', 'Bag', 'Window', 'Parrot', 'Cloud', 'Design', 'Zebra',
  'Book', 'Cat', 'Mobile', 'Dog', 'Tree', 'Computer', 'Bottle', 'Water',
] as const;

export type KnuctSeedWord = (typeof KNUCT_SEED_WORDS)[number];
