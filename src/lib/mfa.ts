import { generateSecret, generateSync, generateURI, verifySync } from 'otplib';

const APP_NAME = 'AIMSCS';

export function generateMfaSecret(): string {
  return generateSecret();
}

export function buildMfaOtpauthUrl(email: string, secret: string): string {
  return generateURI({
    issuer: APP_NAME,
    label: email,
    secret,
  });
}

export function verifyMfaToken(secret: string, token: string): boolean {
  const code = token.replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) return false;
  try {
    const result = verifySync({ secret, token: code });
    return result.valid === true;
  } catch {
    return false;
  }
}

/** Test helper — current TOTP for a secret. */
export function generateMfaToken(secret: string): string {
  return generateSync({ secret });
}

export function isGoogleSsoConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

export function getAuthMethodSummary(): string {
  const parts = ['password', 'Knuct DID'];
  if (isGoogleSsoConfigured()) parts.push('Google SSO');
  parts.push('TOTP MFA');
  return `next-auth JWT (${parts.join(' + ')})`;
}
