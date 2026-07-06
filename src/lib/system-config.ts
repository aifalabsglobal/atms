import { db } from '@/lib/db';
import { emailStatus } from '@/lib/email';
import { isFaceVerificationEnabled } from '@/lib/face-verification';
import { getRateLimitBackend } from '@/lib/rate-limit';
import { isChainPublishEnabled } from '@/lib/knuct/chain-publish';
import { isKnuctLiveEnabled } from '@/lib/knuct/config';
import {
  cloneDefaultSystemConfig,
  parseSystemConfig,
  validateSystemConfig,
  DEFAULT_ATTENDANCE_THRESHOLDS,
  type AttendanceThresholds,
  type SystemConfigSettings,
} from '@/lib/system-config-defaults';

export {
  DEFAULT_SYSTEM_CONFIG,
  DEFAULT_ATTENDANCE_THRESHOLDS,
  cloneDefaultSystemConfig,
  parseSystemConfig,
  validateSystemConfig,
  type AttendanceThresholds,
  type SystemConfigSettings,
} from '@/lib/system-config-defaults';

export interface SystemRuntimeStatus {
  faceVerification: {
    enabled: boolean;
    apiConfigured: boolean;
    mode: 'live' | 'demo' | 'disabled';
  };
  knuct: {
    liveEnabled: boolean;
    anchorsEnabled: boolean;
    chainPublish: boolean;
  };
  email: {
    status: 'configured' | 'disabled';
    provider: string | null;
  };
  rateLimit: { backend: 'upstash' | 'memory' };
  database: { provider: string };
  auth: { method: string };
  geofencing: { algorithm: string };
}

let cachedSettings: SystemConfigSettings | null = null;
let cacheMeta: { updatedAt: string | null; updatedBy: string | null } | null = null;
let cacheTime = 0;
const CACHE_MS = 30_000;

export function invalidateSystemConfigCache() {
  cachedSettings = null;
  cacheMeta = null;
  cacheTime = 0;
}

export function getCachedSystemConfig(): SystemConfigSettings {
  return cachedSettings ?? cloneDefaultSystemConfig();
}

export async function getSystemConfig(): Promise<SystemConfigSettings> {
  if (cachedSettings && Date.now() - cacheTime < CACHE_MS) {
    return cachedSettings;
  }
  try {
    const row = await db.systemConfig.findUnique({ where: { id: 'default' } });
    cachedSettings = row ? parseSystemConfig(row.settings) : cloneDefaultSystemConfig();
    cacheMeta = row
      ? { updatedAt: row.updatedAt.toISOString(), updatedBy: row.updatedBy }
      : { updatedAt: null, updatedBy: null };
  } catch {
    cachedSettings = cloneDefaultSystemConfig();
    cacheMeta = { updatedAt: null, updatedBy: null };
  }
  cacheTime = Date.now();
  return cachedSettings;
}

export async function getAttendanceThresholds(): Promise<AttendanceThresholds> {
  const cfg = await getSystemConfig();
  return cfg.attendance;
}

export async function getSystemConfigMeta(): Promise<{
  settings: SystemConfigSettings;
  defaults: SystemConfigSettings;
  updatedAt: string | null;
  updatedBy: string | null;
  runtime: SystemRuntimeStatus;
}> {
  const settings = await getSystemConfig();
  return {
    settings,
    defaults: cloneDefaultSystemConfig(),
    updatedAt: cacheMeta?.updatedAt ?? null,
    updatedBy: cacheMeta?.updatedBy ?? null,
    runtime: buildRuntimeStatus(settings),
  };
}

export async function saveSystemConfig(
  settings: SystemConfigSettings,
  updatedBy: string,
): Promise<SystemConfigSettings> {
  const validated = validateSystemConfig(settings);
  if ('error' in validated) {
    throw new Error(validated.error);
  }

  await db.systemConfig.upsert({
    where: { id: 'default' },
    create: { id: 'default', settings: validated.settings, updatedBy },
    update: { settings: validated.settings, updatedBy },
  });
  invalidateSystemConfigCache();
  return getSystemConfig();
}

export async function resetSystemConfig(updatedBy: string): Promise<SystemConfigSettings> {
  const defaults = cloneDefaultSystemConfig();
  await db.systemConfig.upsert({
    where: { id: 'default' },
    create: { id: 'default', settings: defaults, updatedBy },
    update: { settings: defaults, updatedBy },
  });
  invalidateSystemConfigCache();
  return getSystemConfig();
}

function buildRuntimeStatus(settings: SystemConfigSettings): SystemRuntimeStatus {
  const faceEnv = isFaceVerificationEnabled();
  const apiUrl = Boolean(process.env.FACE_VERIFICATION_API_URL?.trim());
  let faceMode: 'live' | 'demo' | 'disabled' = 'disabled';
  if (faceEnv && apiUrl) faceMode = 'live';
  else if (faceEnv) faceMode = 'demo';

  let emailProvider: string | null = null;
  if (process.env.RESEND_API_KEY?.trim()) emailProvider = 'Resend';
  else if (process.env.SMTP_HOST?.trim()) emailProvider = 'SMTP';

  return {
    faceVerification: {
      enabled: faceEnv,
      apiConfigured: apiUrl,
      mode: faceMode,
    },
    knuct: {
      liveEnabled: isKnuctLiveEnabled(),
      anchorsEnabled: settings.policies.knuctAnchorsEnabled && process.env.KNUCT_ANCHOR_ENABLED !== 'false',
      chainPublish: isChainPublishEnabled(),
    },
    email: {
      status: emailStatus(),
      provider: emailProvider,
    },
    rateLimit: { backend: getRateLimitBackend() },
    database: { provider: 'PostgreSQL (Neon) + Prisma' },
    auth: { method: 'next-auth JWT (credentials)' },
    geofencing: { algorithm: 'Haversine (circle) + point-in-polygon' },
  };
}

export function isAuditLoggingEnabledSync(): boolean {
  return getCachedSystemConfig().policies.auditLoggingEnabled;
}
