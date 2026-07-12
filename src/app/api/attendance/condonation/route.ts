import { NextResponse } from 'next/server';
import {
  getCampusScope,
  getLinkedStudentId,
  requireSection,
} from '@/lib/auth-helpers';
import { rateLimitByUser } from '@/lib/api-rate-limit';
import { db } from '@/lib/db';
import type { Role } from '@/lib/roles';
import {
  canDecideCondonationRole,
  canStaffViewCondonation,
  canSubmitCondonation,
  canViewCondonation,
  condonationRoleCopy,
} from '@/lib/condonation-roles';
import {
  CondonationError,
  createCondonationRequest,
  listCondonationRequests,
} from '@/lib/condonation-service';
import { getAttendanceThresholds } from '@/lib/system-config';

function toErrorResponse(err: unknown) {
  if (err instanceof CondonationError) {
    const body: Record<string, unknown> = { error: err.message };
    if (err.existingRequestId) body.existingRequestId = err.existingRequestId;
    return NextResponse.json(body, { status: err.status });
  }
  console.error('Condonation API error:', err);
  return NextResponse.json({ error: 'Failed to process condonation request' }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const { error, session } = await requireSection('attendance');
    if (error || !session) return error;

    const role = session.user.role as Role;
    if (!canViewCondonation(role)) {
      return NextResponse.json({ error: 'Forbidden — not part of condonation process' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    if (role === 'student') {
      const where: Record<string, unknown> = { studentId: session.user.id };
      if (status !== 'all') where.status = status;
      const [requests, total] = await Promise.all([
        db.condonationRequest.findMany({
          where,
          include: {
            student: {
              select: { id: true, name: true, email: true, department: true, employeeId: true },
            },
            decidedBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.condonationRequest.count({ where }),
      ]);
      return NextResponse.json({ requests, total, page, limit });
    }

    if (role === 'parent') {
      const wardId =
        session.user.linkedStudentId || (await getLinkedStudentId(session.user.id));
      if (!wardId) {
        return NextResponse.json({ error: 'No linked student for parent account' }, { status: 403 });
      }
      const where: Record<string, unknown> = { studentId: wardId };
      if (status !== 'all') where.status = status;
      const [requests, total] = await Promise.all([
        db.condonationRequest.findMany({
          where,
          include: {
            student: {
              select: { id: true, name: true, email: true, department: true, employeeId: true },
            },
            decidedBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.condonationRequest.count({ where }),
      ]);
      return NextResponse.json({ requests, total, page, limit });
    }

    if (!canStaffViewCondonation(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const scope = await getCampusScope(session);
    const result = await listCondonationRequests(scope, status, page, limit);
    const thresholds = await getAttendanceThresholds({
      departmentId: scope.level === 'department' ? scope.departmentId : undefined,
    });
    return NextResponse.json({
      ...result,
      meta: {
        canDecide: canDecideCondonationRole(role, thresholds.requireHodForCondonation),
        requireHodForCondonation: thresholds.requireHodForCondonation,
        roleCopy: condonationRoleCopy(role),
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const { error, session } = await requireSection('attendance');
    if (error || !session) return error;

    const role = session.user.role as Role;
    if (!canSubmitCondonation(role)) {
      return NextResponse.json({ error: 'Only students can submit condonation requests' }, { status: 403 });
    }

    const limited = await rateLimitByUser(
      request,
      session.user.id,
      'condonation-request',
      5,
      3_600_000,
    );
    if (limited) return limited;

    const body = await request.json().catch(() => ({}));
    const { reason, supportingDocUrl } = body as {
      reason?: string;
      supportingDocUrl?: string;
      studentId?: string;
    };

    if (body.studentId && body.studentId !== session.user.id) {
      return NextResponse.json({ error: 'Cannot submit a request for another student' }, { status: 403 });
    }
    if (!reason || typeof reason !== 'string') {
      return NextResponse.json({ error: 'reason is required' }, { status: 400 });
    }

    const created = await createCondonationRequest(
      session.user.id,
      reason,
      supportingDocUrl,
    );

    return NextResponse.json(
      {
        id: created.id,
        status: created.status,
        attendancePct: created.attendancePct,
        eligibilityPct: created.eligibilityPct,
        condonationPct: created.condonationPct,
        clearedForTerm: created.clearedForTerm,
        createdAt: created.createdAt,
      },
      { status: 201 },
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}
