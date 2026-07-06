import { getKnuctConfig } from './config';
import { knuctVendorPost } from './vendor-http';
import type { CredentialType } from './credential-service';

export function isCredentialMintConfigured(): boolean {
  return (
    getKnuctConfig().enabled &&
    process.env.KNUCT_CREDENTIALS_ENABLED === 'true' &&
    Boolean(process.env.KNUCT_CREDENTIAL_MINT_URL?.trim())
  );
}

export type CredentialMintResult = {
  issued: boolean;
  assetRef: string | null;
  verifyUrl: string | null;
  error?: string;
};

/**
 * Mint a verifiable credential via Knuct when vendor cert API URL is configured.
 * Blocked until vendor documents request/response schema (Phase 2).
 */
export async function mintCredentialOnKnuct(input: {
  userId: string;
  userDid?: string | null;
  type: CredentialType;
  payloadHash: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}): Promise<CredentialMintResult> {
  if (!isCredentialMintConfigured()) {
    return {
      issued: false,
      assetRef: null,
      verifyUrl: null,
      error: 'Knuct credential mint API not configured',
    };
  }

  const url = process.env.KNUCT_CREDENTIAL_MINT_URL!.trim();
  const res = await knuctVendorPost<{
    assetRef?: string;
    assetId?: string;
    tokenId?: string;
    verifyUrl?: string;
    verificationUrl?: string;
  }>(url, {
    userId: input.userId,
    did: input.userDid ?? undefined,
    credentialType: input.type,
    payloadHash: input.payloadHash,
    resourceId: input.resourceId,
    metadata: input.metadata,
    tenantId: getKnuctConfig().tenantId ?? undefined,
  });

  if (!res.ok) {
    return {
      issued: false,
      assetRef: null,
      verifyUrl: null,
      error: res.error ?? `HTTP ${res.status}`,
    };
  }

  const assetRef = res.data?.assetRef ?? res.data?.assetId ?? res.data?.tokenId ?? null;
  const verifyUrl = res.data?.verifyUrl ?? res.data?.verificationUrl ?? null;
  return { issued: true, assetRef, verifyUrl };
}

export async function verifyCredentialOnKnuct(
  assetRef: string
): Promise<{ valid: boolean; error?: string }> {
  const verifyUrl = process.env.KNUCT_CREDENTIAL_VERIFY_URL?.trim();
  if (!verifyUrl) {
    return { valid: false, error: 'KNUCT_CREDENTIAL_VERIFY_URL not configured' };
  }

  const url = verifyUrl.includes('{assetRef}')
    ? verifyUrl.replace('{assetRef}', encodeURIComponent(assetRef))
    : `${verifyUrl.replace(/\/$/, '')}/${encodeURIComponent(assetRef)}`;

  const res = await knuctVendorPost(url, { assetRef });
  if (!res.ok) return { valid: false, error: res.error };
  return { valid: true };
}
