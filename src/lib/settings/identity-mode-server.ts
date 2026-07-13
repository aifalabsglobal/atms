import { getGlobalString } from './service';
import {
  DEFAULT_IDENTITY_MODE,
  parseIdentityMode,
  type IdentityMode,
} from './identity-mode';

/** Server-only: load campus identity mode from settings DB. */
export async function getIdentityMode(): Promise<IdentityMode> {
  const raw = await getGlobalString('auth.identity_mode', DEFAULT_IDENTITY_MODE);
  return parseIdentityMode(raw);
}
