import { NextResponse } from 'next/server';
import { requireSection } from '@/lib/auth-helpers';
import { getClientIp, logAudit } from '@/lib/audit';
import { rateLimitByUser } from '@/lib/api-rate-limit';
import { uploadDocumentFromBase64 } from '@/lib/object-storage';
import { canSubmitCondonation } from '@/lib/condonation-roles';
import type { Role } from '@/lib/roles';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const { error, session } = await requireSection('attendance');
    if (error || !session) return error;

    if (!canSubmitCondonation(session.user.role as Role)) {
      return NextResponse.json({ error: 'Only students can upload condonation evidence' }, { status: 403 });
    }

    const limited = await rateLimitByUser(
      request,
      session.user.id,
      'condonation-upload',
      10,
      3_600_000,
    );
    if (limited) return limited;

    const body = await request.json().catch(() => ({}));
    const fileBase64 = typeof body.fileBase64 === 'string' ? body.fileBase64 : '';
    if (!fileBase64.startsWith('data:')) {
      return NextResponse.json({ error: 'Expected a data:*;base64 payload (image or PDF)' }, { status: 400 });
    }

    const raw = fileBase64.replace(/^data:[^;]+;base64,/, '');
    const approxBytes = Math.floor((raw.length * 3) / 4);
    if (approxBytes > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 400 });
    }

    const stem = `${session.user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { url, backend, contentType } = await uploadDocumentFromBase64(
      'condonation-docs',
      stem,
      fileBase64,
    );

    await logAudit({
      userId: session.user.id,
      action: 'condonation.evidence_upload',
      resource: `user:${session.user.id}`,
      details: { url, backend, contentType, bytes: approxBytes },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ url, backend, contentType });
  } catch (err) {
    console.error('[condonation upload]', err);
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
