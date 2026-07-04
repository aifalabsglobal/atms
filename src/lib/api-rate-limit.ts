import { enforceRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/audit';

export async function rateLimitByIp(
  request: Request,
  bucket: string,
  limit = 30,
  windowMs = 60_000
) {
  const ip = getClientIp(request) ?? 'anon';
  return enforceRateLimit(`${bucket}:${ip}`, limit, windowMs);
}

export async function rateLimitByUser(
  request: Request,
  userId: string,
  bucket: string,
  limit = 30,
  windowMs = 60_000
) {
  const ip = getClientIp(request) ?? 'anon';
  return enforceRateLimit(`${bucket}:${userId}:${ip}`, limit, windowMs);
}
