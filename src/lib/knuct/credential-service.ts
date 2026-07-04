import { db } from '@/lib/db';
import { getKnuctConfig } from './config';

export type CredentialType = 'attendance_certificate' | 'grade_transcript' | 'compliance_report';

export function isCredentialEnabled(): boolean {
  return getKnuctConfig().enabled && process.env.KNUCT_CREDENTIALS_ENABLED === 'true';
}

/** Phase 2 stub — blocked until Knuct mint/verify APIs are documented. */
export async function issueCredential(
  _userId: string,
  _type: CredentialType,
  _payload: Record<string, unknown>
): Promise<{ id: string; status: 'unavailable' }> {
  if (!isCredentialEnabled()) {
    return { id: 'stub', status: 'unavailable' };
  }

  console.warn('[knuct] credential issue requested but Knuct cert APIs are not integrated');
  return { id: 'stub', status: 'unavailable' };
}

export async function getCredentialStats() {
  return {
    today: 0,
    week: 0,
    failed: 0,
    byType: {} as Record<string, number>,
  };
}

export async function getUserCredentials(userId: string) {
  void userId;
  return [];
}
