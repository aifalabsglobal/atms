import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireSection } from '@/lib/auth-helpers';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/audit';
import { enrichAuditLogsWithAnchors, AUDIT_ANCHOR_ACTIONS } from '@/lib/knuct/anchor-audit';

export async function GET(request: Request) {
  try {
    const limited = await enforceRateLimit(`audit:${getClientIp(request) ?? 'anon'}`, 30, 60_000);
    if (limited) return limited;

    const { error, session } = await requireSection('settings');
    if (error || !session) return error;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    const where: Record<string, unknown> = {};
    if (action) where.action = action;
    if (searchParams.get('anchorableOnly') === 'true') {
      where.action = { in: [...AUDIT_ANCHOR_ACTIONS] };
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.auditLog.count({ where }),
    ]);

    const actorIds = [...new Set(logs.map((l) => l.userId).filter(Boolean))] as string[];
    const actors =
      actorIds.length > 0
        ? await db.user.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, name: true, email: true, role: true },
          })
        : [];
    const actorMap = Object.fromEntries(actors.map((a) => [a.id, a]));

    const enriched = await enrichAuditLogsWithAnchors(logs);

    return NextResponse.json({
      logs: enriched.map((log) => ({
        ...log,
        actor: log.userId ? actorMap[log.userId] ?? null : null,
      })),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Audit API error:', error);
    return NextResponse.json({ error: 'Failed to load audit logs' }, { status: 500 });
  }
}
