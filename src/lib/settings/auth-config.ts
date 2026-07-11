import { getGlobalBoolean, getGlobalNumber, getGlobalString } from './service';

export type AuthSettings = {
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSpecial: boolean;
  maxFailedLogins: number;
  lockoutMinutes: number;
  selfRegistrationEnabled: boolean;
  defaultRole: string;
  tempPasswordLength: number;
};

export const DEFAULT_AUTH_SETTINGS: AuthSettings = {
  passwordMinLength: 8,
  passwordRequireUppercase: false,
  passwordRequireNumber: true,
  passwordRequireSpecial: false,
  maxFailedLogins: 5,
  lockoutMinutes: 15,
  selfRegistrationEnabled: true,
  defaultRole: 'student',
  tempPasswordLength: 10,
};

export async function getAuthSettings(): Promise<AuthSettings> {
  const [
    passwordMinLength,
    passwordRequireUppercase,
    passwordRequireNumber,
    passwordRequireSpecial,
    maxFailedLogins,
    lockoutMinutes,
    selfRegistrationEnabled,
    defaultRole,
    tempPasswordLength,
  ] = await Promise.all([
    getGlobalNumber('users.password_min_length', DEFAULT_AUTH_SETTINGS.passwordMinLength),
    getGlobalBoolean('users.password_require_uppercase', DEFAULT_AUTH_SETTINGS.passwordRequireUppercase),
    getGlobalBoolean('users.password_require_number', DEFAULT_AUTH_SETTINGS.passwordRequireNumber),
    getGlobalBoolean('users.password_require_special', DEFAULT_AUTH_SETTINGS.passwordRequireSpecial),
    getGlobalNumber('users.max_failed_logins', DEFAULT_AUTH_SETTINGS.maxFailedLogins),
    getGlobalNumber('users.lockout_minutes', DEFAULT_AUTH_SETTINGS.lockoutMinutes),
    getGlobalBoolean('users.self_registration_enabled', DEFAULT_AUTH_SETTINGS.selfRegistrationEnabled),
    getGlobalString('users.default_role', DEFAULT_AUTH_SETTINGS.defaultRole),
    getGlobalNumber('users.temp_password_length', DEFAULT_AUTH_SETTINGS.tempPasswordLength),
  ]);

  return {
    passwordMinLength: Math.min(128, Math.max(6, Math.round(passwordMinLength) || 8)),
    passwordRequireUppercase: Boolean(passwordRequireUppercase),
    passwordRequireNumber: Boolean(passwordRequireNumber),
    passwordRequireSpecial: Boolean(passwordRequireSpecial),
    maxFailedLogins: Math.min(50, Math.max(0, Math.round(maxFailedLogins) || 0)),
    lockoutMinutes: Math.min(1440, Math.max(1, Math.round(lockoutMinutes) || 15)),
    selfRegistrationEnabled: Boolean(selfRegistrationEnabled),
    defaultRole: defaultRole || 'student',
    tempPasswordLength: Math.min(32, Math.max(8, Math.round(tempPasswordLength) || 10)),
  };
}

/** Validate a candidate password against auth settings. Returns error message or null. */
export function validatePasswordAgainstPolicy(password: string, settings: AuthSettings): string | null {
  if (!password || password.length < settings.passwordMinLength) {
    return `Password must be at least ${settings.passwordMinLength} characters.`;
  }
  if (settings.passwordRequireUppercase && !/[A-Z]/.test(password)) {
    return 'Password must include an uppercase letter.';
  }
  if (settings.passwordRequireNumber && !/[0-9]/.test(password)) {
    return 'Password must include a number.';
  }
  if (settings.passwordRequireSpecial && !/[^A-Za-z0-9]/.test(password)) {
    return 'Password must include a special character.';
  }
  return null;
}

type LockState = { failures: number; lockedUntil: number };

const loginFailures = new Map<string, LockState>();

export function getLoginLockState(email: string): { locked: boolean; retryAfterSeconds: number } {
  const key = email.trim().toLowerCase();
  const state = loginFailures.get(key);
  if (!state?.lockedUntil) return { locked: false, retryAfterSeconds: 0 };
  const remaining = state.lockedUntil - Date.now();
  if (remaining <= 0) {
    loginFailures.delete(key);
    return { locked: false, retryAfterSeconds: 0 };
  }
  return { locked: true, retryAfterSeconds: Math.ceil(remaining / 1000) };
}

export function recordLoginFailure(email: string, settings: AuthSettings): { locked: boolean } {
  if (settings.maxFailedLogins <= 0) return { locked: false };
  const key = email.trim().toLowerCase();
  const prev = loginFailures.get(key) ?? { failures: 0, lockedUntil: 0 };
  if (prev.lockedUntil > Date.now()) return { locked: true };
  const failures = prev.failures + 1;
  if (failures >= settings.maxFailedLogins) {
    loginFailures.set(key, {
      failures: 0,
      lockedUntil: Date.now() + settings.lockoutMinutes * 60_000,
    });
    return { locked: true };
  }
  loginFailures.set(key, { failures, lockedUntil: 0 });
  return { locked: false };
}

export function clearLoginFailures(email: string) {
  loginFailures.delete(email.trim().toLowerCase());
}
