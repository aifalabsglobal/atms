import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function resolveKey(): Buffer {
  const envKey = process.env.KNUCT_PRIVSHARE_ENC_KEY?.trim();
  if (envKey) {
    if (/^[0-9a-fA-F]{64}$/.test(envKey)) {
      return Buffer.from(envKey, 'hex');
    }
    return scryptSync(envKey, 'knuct-privshare', 32);
  }
  const fallback = process.env.NEXTAUTH_SECRET;
  if (!fallback) {
    throw new Error('KNUCT_PRIVSHARE_ENC_KEY or NEXTAUTH_SECRET required for privshare encryption');
  }
  return scryptSync(`${fallback}:knuct-privshare`, 'knuct-salt', 32);
}

/** AES-256-GCM encrypt; output = iv (12) + tag (16) + ciphertext */
export function encryptBuffer(plain: Buffer): Buffer {
  const key = resolveKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

export function decryptBuffer(payload: Buffer): Buffer {
  const key = resolveKey();
  const iv = payload.subarray(0, IV_LEN);
  const tag = payload.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = payload.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}
