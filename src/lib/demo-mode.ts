import { DEMO_PASSWORD } from '@/lib/demo-accounts';

export const PLACEHOLDER_PASSWORD_HASH = '$2a$10$placeholder';

/** Demo password + role switcher — off in production unless ALLOW_DEMO_AUTH=true. */
export function isDemoAuthAllowed(): boolean {
  const flag = process.env.ALLOW_DEMO_AUTH;
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

export function isPlaceholderPasswordHash(hash: string): boolean {
  return hash === PLACEHOLDER_PASSWORD_HASH;
}

export function verifyPlaceholderPassword(password: string): boolean {
  return isDemoAuthAllowed() && password === DEMO_PASSWORD;
}
