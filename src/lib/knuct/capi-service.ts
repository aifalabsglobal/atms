import { getKnuctConfig } from './config';
import { loadUserKnuctSession, refreshUserKnuctSession } from './knuct-persistent-session';

export async function fetchKnuctAccountInfo(userId: string): Promise<unknown | null> {
  if (!getKnuctConfig().enabled) return null;
  const adapter = await loadUserKnuctSession(userId);
  if (!adapter) return null;
  try {
    const info = await adapter.capiGetAccountInfo();
    await refreshUserKnuctSession(userId, adapter);
    return info;
  } catch (err) {
    console.warn('[knuct] capiGetAccountInfo failed:', err);
    return null;
  }
}

export async function fetchKnuctWalletDashboard(userId: string): Promise<unknown | null> {
  if (!getKnuctConfig().enabled) return null;
  const adapter = await loadUserKnuctSession(userId);
  if (!adapter) return null;
  try {
    const dashboard = await adapter.capiGetDashboard();
    await refreshUserKnuctSession(userId, adapter);
    return dashboard;
  } catch (err) {
    console.warn('[knuct] capiGetDashboard failed:', err);
    return null;
  }
}

export async function fetchKnuctCapiBundle(userId: string): Promise<{
  accountInfo: unknown | null;
  dashboard: unknown | null;
  sessionActive: boolean;
}> {
  if (!getKnuctConfig().enabled) {
    return { accountInfo: null, dashboard: null, sessionActive: false };
  }
  const adapter = await loadUserKnuctSession(userId);
  if (!adapter) {
    return { accountInfo: null, dashboard: null, sessionActive: false };
  }

  let accountInfo: unknown | null = null;
  let dashboard: unknown | null = null;

  try {
    accountInfo = await adapter.capiGetAccountInfo();
  } catch (err) {
    console.warn('[knuct] capiGetAccountInfo failed:', err);
  }

  try {
    dashboard = await adapter.capiGetDashboard();
  } catch (err) {
    console.warn('[knuct] capiGetDashboard failed:', err);
  }

  await refreshUserKnuctSession(userId, adapter);
  return { accountInfo, dashboard, sessionActive: true };
}
