import { NextResponse } from 'next/server';
import { requireRoles } from '@/lib/auth-helpers';
import { getClientIp, logAudit } from '@/lib/audit';
import { uploadImageFromBase64 } from '@/lib/object-storage';
import { setSetting } from '@/lib/settings';
import { enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit(
      `branding-upload:${getClientIp(request) ?? 'anon'}`,
      10,
      60_000,
    );
    if (limited) return limited;

    const { error, session } = await requireRoles(['super_admin']);
    if (error || !session) return error;

    const body = await request.json().catch(() => ({}));
    const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : '';
    const target = body.target === 'favicon' ? 'favicon' : 'logo';

    if (!imageBase64.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Expected a data:image/*;base64 payload' }, { status: 400 });
    }

    const raw = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const approxBytes = Math.floor((raw.length * 3) / 4);
    if (approxBytes > MAX_BYTES) {
      return NextResponse.json({ error: 'Image too large (max 2 MB)' }, { status: 400 });
    }

    const stem = `${target}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { url, backend } = await uploadImageFromBase64('branding', stem, imageBase64);

    const key = target === 'favicon' ? 'general.favicon_url' : 'general.logo_url';
    const setting = await setSetting(key, url, {
      scope: 'global',
      updatedBy: session.user.id,
      reason: `branding upload (${backend})`,
    });

    await logAudit({
      userId: session.user.id,
      action: 'settings.branding_upload',
      resource: `setting:${key}`,
      details: { key, url, backend, target },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ url, key, backend, setting });
  } catch (err) {
    console.error('[branding upload]', err);
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
