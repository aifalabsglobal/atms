import { getGlobalString } from './service';
import { db } from '@/lib/db';
import {
  DEFAULT_IDENTITY_MODE,
  parseIdentityMode,
  type IdentityMode,
} from './identity-mode';

/** Server-only: campus ATMS is always password_only; Knuct lives on /knuct. */
export async function getIdentityMode(): Promise<IdentityMode> {
  const raw = await getGlobalString('auth.identity_mode', DEFAULT_IDENTITY_MODE);
  const mode = parseIdentityMode(raw);
  if (mode !== 'password_only') {
    try {
      await db.settingValue.upsert({
        where: {
          key_scope_scopeId: {
            key: 'auth.identity_mode',
            scope: 'global',
            scopeId: '',
          },
        },
        create: {
          key: 'auth.identity_mode',
          scope: 'global',
          scopeId: '',
          value: 'password_only',
        },
        update: { value: 'password_only' },
      });
    } catch {
      // Best-effort coerce; still return password_only to callers.
    }
  }
  return 'password_only';
}
