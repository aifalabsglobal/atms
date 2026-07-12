import { NextResponse } from 'next/server';
import {
  getCampusScope,
  requireSection,
  requireStaffSection,
} from '@/lib/auth-helpers';
import { rateLimitByUser } from '@/lib/api-rate-limit';
import { getClientIp } from '@/lib/audit';
import type { Role } from '@/lib/roles';
import {
  CondonationError,
  decideCondonationRequest,
  withdrawCondonationRequest,
} from '@/lib/condonation-service';
import { canStaffViewCondonation, canSubmitCondonation } from '@/lib/condonation-roles';

type RouteContext = { params: Promise<{ id: string }> };

function toErrorResponse(err: unknown) {
  if (err instanceof CondonationError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error('Condonation [id] API error:', err);
  return NextResponse.json({ error: 'Failed to update condonation request' }, { status: 500 });
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { error, session } = await requireStaffSection('attendance');
    if (error || !session) return error;

    const role = session.user.role as Role;
    if (!canStaffViewCondonation(role)) {
      return NextResponse.json({ error: 'Forbidden — not part of condonation process' }, { status: 403 });
    }

    const limited = await rateLimitByUser(
      request,
      session.user.id,
      'condonation-decision',
      30,
      60_000,
    );
    if (limited) return limited;

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const decision = body.decision as string | undefined;
    const notes = (body.notes ?? body.decisionNotes) as string | undefined;

    if (decision !== 'approved' && decision !== 'rejected') {
      return NextResponse.json({ error: 'decision must be approved or rejected' }, { status: 400 });
    }

    const scope = await getCampusScope(session);
    const updated = await decideCondonationRequest({
      requestId: id,
      decidedById: session.user.id,
      role,
      scope,
      decision,
      decisionNotes: notes,
      ipAddress: getClientIp(request),
    });

    return NextResponse.json(updated);
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { error, session } = await requireSection('attendance');
    if (error || !session) return error;

    if (!canSubmitCondonation(session.user.role as Role)) {
      return NextResponse.json({ error: 'Only students can withdraw their requests' }, { status: 403 });
    }

    const { id } = await context.params;
    const updated = await withdrawCondonationRequest(session.user.id, id);
    return NextResponse.json(updated);
  } catch (err) {
    return toErrorResponse(err);
  }
}
