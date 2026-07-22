/** Client-safe identity mode helpers (no DB / nodemailer imports). */

export type IdentityMode = 'password_only' | 'hybrid' | 'knuct_based';

export const DEFAULT_IDENTITY_MODE: IdentityMode = 'password_only';

export const IDENTITY_MODE_LABELS: Record<IdentityMode, string> = {
  password_only: 'Password only (Postgres + next-auth)',
  hybrid: 'Hybrid (password + Knuct)',
  knuct_based: 'Knuct-based (DID primary)',
};

export function parseIdentityMode(raw: unknown): IdentityMode {
  const value = String(raw ?? '').trim();
  if (value === 'hybrid' || value === 'knuct_based' || value === 'password_only') {
    return value;
  }
  return DEFAULT_IDENTITY_MODE;
}

/** Knuct wallets / DID / admin panels allowed by campus policy. */
export function isKnuctUiEnabled(mode: IdentityMode): boolean {
  return mode !== 'password_only';
}

/** Show Knuct DID tab on the login page. */
export function isKnuctLoginVisible(mode: IdentityMode): boolean {
  return mode === 'hybrid' || mode === 'knuct_based';
}

/** Default login tab should be Knuct DID. */
export function preferKnuctLogin(mode: IdentityMode): boolean {
  return mode === 'knuct_based';
}

export function formatIdentityModePreview(mode: IdentityMode): string {
  if (mode === 'password_only') {
    return 'Login: password only · Knuct UI: off';
  }
  if (mode === 'knuct_based') {
    return 'Login: Knuct DID primary · password break-glass · Knuct UI: on';
  }
  return 'Login: password primary · Knuct DID available · Knuct UI: on';
}

/** Server gate for Knuct mutating/feature APIs when campus policy is password_only. */
export function knuctPolicyBlockedMessage(): string {
  return 'Knuct interactive features live on the standalone console at /knuct/login.';
}
