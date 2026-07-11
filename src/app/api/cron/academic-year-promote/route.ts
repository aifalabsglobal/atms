import { NextResponse } from 'next/server';
import { promoteDueAcademicYears } from '@/lib/academic-year-promote';

export const dynamic = 'force-dynamic';

/**
 * Promote due upcoming academic years when Organization auto-promote is On.
 * Secure with CRON_SECRET: Authorization: Bearer <CRON_SECRET>
 * Also callable by Super Admin session via POST for manual runs.
 */
export async function GET(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const auth = request.headers.get('authorization');
    const okCron = Boolean(cronSecret) && auth === `Bearer ${cronSecret}`;

    // Allow unauthenticated only in development without CRON_SECRET (local smoke)
    const okDev = process.env.NODE_ENV !== 'production' && !cronSecret;

    if (!okCron && !okDev) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await promoteDueAcademicYears();
    return NextResponse.json(result);
  } catch (err) {
    console.error('Academic year promote cron error:', err);
    return NextResponse.json({ error: 'Promotion failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { requireSection } = await import('@/lib/auth-helpers');
    const { error, session } = await requireSection('masters');
    if (error || !session) return error;
    if (session.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only Super Admin can run promotion manually' }, { status: 403 });
    }

    const result = await promoteDueAcademicYears();
    return NextResponse.json(result);
  } catch (err) {
    console.error('Academic year promote manual error:', err);
    return NextResponse.json({ error: 'Promotion failed' }, { status: 500 });
  }
}
