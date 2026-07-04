import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Public anchor lookup by full or partial SHA-256 hash (Phase 3 verify). */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const hash = searchParams.get('hash')?.trim().toLowerCase();

    if (!hash || hash.length < 8) {
      return NextResponse.json(
        { error: 'Provide hash query param (min 8 hex characters)' },
        { status: 400 }
      );
    }

    if (!/^[a-f0-9]+$/.test(hash)) {
      return NextResponse.json({ error: 'Hash must be hexadecimal' }, { status: 400 });
    }

    const anchor =
      hash.length >= 64
        ? await db.blockchainAnchor.findFirst({
            where: { payloadHash: hash },
          })
        : await db.blockchainAnchor.findFirst({
            where: { payloadHash: { startsWith: hash } },
            orderBy: { createdAt: 'desc' },
          });

    if (!anchor) {
      return NextResponse.json({ verified: false, message: 'No matching anchor found' });
    }

    return NextResponse.json({
      verified: true,
      anchor: {
        id: anchor.id,
        resourceType: anchor.resourceType,
        resourceId: anchor.resourceId,
        payloadHash: anchor.payloadHash,
        status: anchor.status,
        knuctTxRef: anchor.knuctTxRef,
        createdAt: anchor.createdAt.toISOString(),
        chainPublished: Boolean(anchor.knuctTxRef),
      },
    });
  } catch (err) {
    console.error('[verify] anchor lookup error:', err);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
