import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireKnuctOpsAccess } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { error, session } = await requireKnuctOpsAccess();
    if (error || !session) return error;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const resourceType = searchParams.get('resourceType');

    const where: Record<string, unknown> = {};
    if (resourceType) where.resourceType = resourceType;

    const [anchors, total] = await Promise.all([
      db.blockchainAnchor.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.blockchainAnchor.count({ where }),
    ]);

    return NextResponse.json({ anchors, total, page, limit });
  } catch (err) {
    console.error('[knuct] anchors list error:', err);
    return NextResponse.json({ error: 'Failed to load anchors' }, { status: 500 });
  }
}
