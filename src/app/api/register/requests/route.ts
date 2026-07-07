import { NextResponse } from 'next/server';
import { requireUserManagement } from '@/lib/auth-helpers';
import {
  approveRegistrationRequest,
  listRegistrationRequests,
  rejectRegistrationRequest,
} from '@/lib/knuct/registration-service';
import type { Role } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { error, session } = await requireUserManagement();
    if (error || !session) return error;

    const status = new URL(req.url).searchParams.get('status') ?? 'pending';
    const requests = await listRegistrationRequests(status);
    return NextResponse.json({ requests, total: requests.length });
  } catch (err) {
    console.error('[register/requests] GET error:', err);
    return NextResponse.json({ error: 'Failed to load registration requests' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { error, session } = await requireUserManagement();
    if (error || !session) return error;

    const body = (await req.json()) as {
      id?: string;
      action?: 'approve' | 'reject';
      role?: Role;
      departmentId?: string | null;
      department?: string | null;
      reason?: string;
    };

    if (!body.id || !body.action) {
      return NextResponse.json({ error: 'id and action are required' }, { status: 400 });
    }

    const reviewerRole = session.user.role as Role;

    if (body.action === 'approve') {
      const user = await approveRegistrationRequest({
        requestId: body.id,
        reviewerId: session.user.id,
        reviewerRole,
        role: body.role,
        departmentId: body.departmentId,
        department: body.department,
      });
      return NextResponse.json({
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    }

    if (body.action === 'reject') {
      await rejectRegistrationRequest({
        requestId: body.id,
        reviewerId: session.user.id,
        reason: body.reason,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Review failed';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
