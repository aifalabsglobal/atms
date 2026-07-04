import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getDemoReadiness, runDemoBootstrap } from '@/lib/demo-bootstrap';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/audit';

const BOOTSTRAP_ROLES = ['super_admin', 'admin', 'faculty', 'hod', 'lab_assistant'];

export async function GET() {
  try {
    const { error, session } = await requireAuth();
    if (error || !session) return error;

    const status = await getDemoReadiness();
    const codingCount = status.coding.skipped;

    return NextResponse.json({
      ready: status.ready,
      codingProblems: codingCount,
      bundledTotal: status.coding.total,
      hint: status.ready
        ? 'Demo data looks good'
        : 'Click "Load demo problems" or run: npm run db:seed',
    });
  } catch (err) {
    console.error('Demo status error:', err);
    return NextResponse.json({ error: 'Failed to check demo status' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { error, session } = await requireAuth();
    if (error || !session) return error;

    if (!BOOTSTRAP_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const limited = await enforceRateLimit(
      `demo-bootstrap:${session.user.id}:${getClientIp(request) ?? 'anon'}`,
      5,
      3_600_000
    );
    if (limited) return limited;

    const result = await runDemoBootstrap();

    return NextResponse.json({
      message: result.coding.created > 0
        ? `Loaded ${result.coding.created} coding problem(s)`
        : 'Demo problems already present',
      ...result,
    });
  } catch (err) {
    console.error('Demo bootstrap error:', err);
    return NextResponse.json({ error: 'Failed to bootstrap demo data' }, { status: 500 });
  }
}
