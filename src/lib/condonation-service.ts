import { db } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { enqueueAnchor } from '@/lib/knuct/anchor-service';
import { createInAppNotification } from '@/lib/notifications';
import {
  getStudentAttendancePct,
  notifyLinkedParents,
} from '@/lib/attendance-notifications';
import { getAttendanceThresholds, getSystemConfig } from '@/lib/system-config';
import { sendCondonationDecisionEmail } from '@/lib/email';
import type { CampusScope } from '@/lib/auth-helpers';
import type { Role } from '@/lib/roles';
import { canDecideCondonationRole } from '@/lib/condonation-roles';

export class CondonationError extends Error {
  status: number;
  existingRequestId?: string;

  constructor(message: string, status: number, existingRequestId?: string) {
    super(message);
    this.name = 'CondonationError';
    this.status = status;
    this.existingRequestId = existingRequestId;
  }
}

export type CondonationEligibility = {
  attendancePct: number;
  eligibilityPct: number;
  condonationPct: number;
  requireHodForCondonation: boolean;
  departmentId: string | null;
  total: number;
};

export type StudentCondonationClearance = {
  clearedForTerm: boolean;
  clearedAt: string | null;
  academicYearId: string | null;
  requestId: string | null;
  attendancePctSnapshot: number | null;
};

async function resolveActiveAcademicYearId(): Promise<string | null> {
  const active = await db.academicYear.findFirst({
    where: { status: 'active', isActive: true },
    select: { id: true },
    orderBy: { startDate: 'desc' },
  });
  return active?.id ?? null;
}

/** Latest approved clearance for a student (enterprise outcome). */
export async function getStudentCondonationClearance(
  studentId: string,
): Promise<StudentCondonationClearance> {
  const row = await db.condonationRequest.findFirst({
    where: { studentId, status: 'approved', clearedForTerm: true },
    orderBy: { clearedAt: 'desc' },
    select: {
      id: true,
      clearedForTerm: true,
      clearedAt: true,
      academicYearId: true,
      attendancePct: true,
    },
  });
  if (!row) {
    return {
      clearedForTerm: false,
      clearedAt: null,
      academicYearId: null,
      requestId: null,
      attendancePctSnapshot: null,
    };
  }
  return {
    clearedForTerm: true,
    clearedAt: row.clearedAt?.toISOString() ?? null,
    academicYearId: row.academicYearId,
    requestId: row.id,
    attendancePctSnapshot: row.attendancePct,
  };
}

export async function getCondonationClearanceMap(
  studentIds: string[],
): Promise<Map<string, StudentCondonationClearance>> {
  const map = new Map<string, StudentCondonationClearance>();
  if (studentIds.length === 0) return map;

  const rows = await db.condonationRequest.findMany({
    where: {
      studentId: { in: studentIds },
      status: 'approved',
      clearedForTerm: true,
    },
    orderBy: { clearedAt: 'desc' },
    select: {
      id: true,
      studentId: true,
      clearedForTerm: true,
      clearedAt: true,
      academicYearId: true,
      attendancePct: true,
    },
  });

  for (const row of rows) {
    if (map.has(row.studentId)) continue;
    map.set(row.studentId, {
      clearedForTerm: true,
      clearedAt: row.clearedAt?.toISOString() ?? null,
      academicYearId: row.academicYearId,
      requestId: row.id,
      attendancePctSnapshot: row.attendancePct,
    });
  }
  return map;
}

/**
 * Rule 2a: Eligible band is condonationPct <= attendancePct < eligibilityPct.
 * Reject creation outside that band with a specific message for each side.
 */
export async function validateCondonationEligibility(
  studentId: string,
): Promise<CondonationEligibility> {
  const student = await db.user.findUnique({
    where: { id: studentId },
    select: { departmentId: true, role: true },
  });
  if (!student || student.role !== 'student') {
    throw new CondonationError('Only student accounts can request condonation', 403);
  }

  const { pct, total } = await getStudentAttendancePct(studentId);
  const thresholds = await getAttendanceThresholds({ departmentId: student.departmentId });

  if (pct >= thresholds.eligibilityPct) {
    throw new CondonationError('Already eligible, no condonation needed', 400);
  }
  if (pct < thresholds.condonationPct) {
    throw new CondonationError(
      'Below the condonable range — this requires a direct HOD exception, not a condonation request',
      400,
    );
  }

  return {
    attendancePct: pct,
    eligibilityPct: thresholds.eligibilityPct,
    condonationPct: thresholds.condonationPct,
    requireHodForCondonation: thresholds.requireHodForCondonation,
    departmentId: student.departmentId,
    total,
  };
}

/**
 * Rule 2b: one pending request per student.
 * Rule 2e: snapshot pct/thresholds at create time; never recompute at decide.
 */
export async function createCondonationRequest(
  studentId: string,
  reason: string,
  supportingDocUrl?: string | null,
) {
  const trimmed = reason.trim();
  if (trimmed.length < 20) {
    throw new CondonationError('Reason must be at least 20 characters', 400);
  }

  const pending = await db.condonationRequest.findFirst({
    where: { studentId, status: 'pending' },
    select: { id: true },
  });
  if (pending) {
    throw new CondonationError(
      'You already have a pending condonation request',
      409,
      pending.id,
    );
  }

  const eligibility = await validateCondonationEligibility(studentId);

  return db.condonationRequest.create({
    data: {
      studentId,
      departmentId: eligibility.departmentId,
      attendancePct: eligibility.attendancePct,
      eligibilityPct: eligibility.eligibilityPct,
      condonationPct: eligibility.condonationPct,
      reason: trimmed,
      supportingDocUrl: supportingDocUrl?.trim() || null,
      status: 'pending',
    },
  });
}

export async function listCondonationRequests(
  scope: CampusScope,
  status = 'pending',
  page = 1,
  limit = 20,
) {
  const where: Record<string, unknown> = {};
  if (status && status !== 'all') where.status = status;

  if (scope.level === 'department') {
    where.departmentId = scope.departmentId;
  } else if (scope.level === 'instructor') {
    const enrollments = await db.courseEnrollment.findMany({
      where: { courseId: { in: scope.courseIds }, status: 'enrolled' },
      select: { studentId: true },
      distinct: ['studentId'],
    });
    const studentIds = enrollments.map((e) => e.studentId);
    where.studentId = { in: studentIds.length > 0 ? studentIds : ['__none__'] };
  }

  const [requests, total] = await Promise.all([
    db.condonationRequest.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            departmentId: true,
            employeeId: true,
          },
        },
        decidedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.condonationRequest.count({ where }),
  ]);

  return { requests, total, page, limit };
}

export async function assertCanDecideCondonation(params: {
  role: Role;
  scope: CampusScope;
  request: {
    id: string;
    studentId: string;
    departmentId: string | null;
  };
}): Promise<{ departmentFallback: boolean; requireHod: boolean }> {
  const { role, scope, request } = params;

  // Rule 2c: null department — Admin/Super Admin only; log distinctly at decide time.
  if (!request.departmentId) {
    if (role !== 'admin' && role !== 'super_admin') {
      throw new CondonationError(
        'This request has no department; only Admin or Super Admin can decide',
        403,
      );
    }
    return { departmentFallback: true, requireHod: false };
  }

  const thresholds = await getAttendanceThresholds({ departmentId: request.departmentId });
  const requireHod = thresholds.requireHodForCondonation;

  if (!canDecideCondonationRole(role, requireHod)) {
    throw new CondonationError(
      requireHod
        ? 'Condonation decisions for this department require the matching HOD (or Admin)'
        : 'You are not allowed to decide condonation requests',
      403,
    );
  }

  if (scope.level === 'all') {
    return { departmentFallback: false, requireHod };
  }

  if (requireHod) {
    if (role === 'hod' && scope.level === 'department' && scope.departmentId === request.departmentId) {
      return { departmentFallback: false, requireHod };
    }
    throw new CondonationError(
      'Condonation decisions for this department require the matching HOD (or Admin)',
      403,
    );
  }

  if (scope.level === 'department') {
    if (scope.departmentId === request.departmentId) {
      return { departmentFallback: false, requireHod };
    }
    throw new CondonationError('Request is outside your department scope', 403);
  }

  if (scope.level === 'instructor') {
    const enrollment = await db.courseEnrollment.findFirst({
      where: {
        studentId: request.studentId,
        courseId: { in: scope.courseIds },
        status: 'enrolled',
      },
      select: { id: true },
    });
    if (enrollment) {
      return { departmentFallback: false, requireHod };
    }
    throw new CondonationError('Request is outside your course scope', 403);
  }

  throw new CondonationError('Forbidden', 403);
}

export async function decideCondonationRequest(params: {
  requestId: string;
  decidedById: string;
  role: Role;
  scope: CampusScope;
  decision: 'approved' | 'rejected';
  decisionNotes?: string | null;
  ipAddress?: string | null;
}) {
  const existing = await db.condonationRequest.findUnique({
    where: { id: params.requestId },
    include: {
      student: { select: { id: true, name: true, email: true } },
    },
  });
  if (!existing) {
    throw new CondonationError('Condonation request not found', 404);
  }
  if (existing.status !== 'pending') {
    throw new CondonationError('Request is no longer pending', 409);
  }

  const { departmentFallback } = await assertCanDecideCondonation({
    role: params.role,
    scope: params.scope,
    request: existing,
  });

  if (params.decision === 'rejected' && !params.decisionNotes?.trim()) {
    throw new CondonationError('Decision notes are required when rejecting', 400);
  }

  if (departmentFallback) {
    await logAudit({
      userId: params.decidedById,
      action: 'condonation.no_department_fallback',
      resource: `condonation:${existing.id}`,
      details: { studentId: existing.studentId, decision: params.decision },
      ipAddress: params.ipAddress,
    });
  }

  const decidedAt = new Date();
  const academicYearId =
    params.decision === 'approved' ? await resolveActiveAcademicYearId() : null;

  const updated = await db.condonationRequest.update({
    where: { id: existing.id },
    data: {
      status: params.decision,
      decidedById: params.decidedById,
      decidedAt,
      decisionNotes: params.decisionNotes?.trim() || null,
      ...(params.decision === 'approved'
        ? {
            clearedForTerm: true,
            clearedAt: decidedAt,
            academicYearId,
          }
        : {
            clearedForTerm: false,
            clearedAt: null,
            academicYearId: null,
          }),
    },
    include: {
      student: { select: { id: true, name: true, email: true } },
    },
  });

  await logAudit({
    userId: params.decidedById,
    action: 'condonation.decision',
    resource: `condonation:${updated.id}`,
    details: {
      decision: params.decision,
      studentId: updated.studentId,
      decidedById: params.decidedById,
      departmentFallback,
      clearedForTerm: updated.clearedForTerm,
      academicYearId: updated.academicYearId,
    },
    ipAddress: params.ipAddress,
  });

  enqueueAnchor('condonation_decision', updated.id, {
    studentId: updated.studentId,
    decision: params.decision,
    attendancePct: updated.attendancePct,
    decidedById: params.decidedById,
    decidedAt: decidedAt.toISOString(),
    clearedForTerm: updated.clearedForTerm,
  });

  const title =
    params.decision === 'approved'
      ? 'Condonation cleared for term'
      : 'Condonation request not approved';
  const message =
    params.decision === 'approved'
      ? `Your condonation was approved. You are marked Cleared for this term (attendance was ${updated.attendancePct}% when you applied). Raw % is unchanged.`
      : `Your condonation request was not approved.${params.decisionNotes?.trim() ? ` Notes: ${params.decisionNotes.trim()}` : ''}`;

  await createInAppNotification({
    userId: updated.studentId,
    title,
    message,
    type: params.decision === 'approved' ? 'success' : 'warning',
    link: '/',
  });
  await notifyLinkedParents(updated.studentId, title, message);

  const config = await getSystemConfig();
  if (config.notifications.lowAttendanceEmailEnabled && updated.student.email) {
    await sendCondonationDecisionEmail(
      updated.student.email,
      updated.student.name,
      params.decision,
      params.decisionNotes?.trim() || undefined,
    ).catch((err) => console.error('Condonation email failed:', err));
  }

  return updated;
}

export async function withdrawCondonationRequest(studentId: string, requestId: string) {
  const existing = await db.condonationRequest.findUnique({ where: { id: requestId } });
  if (!existing) {
    throw new CondonationError('Condonation request not found', 404);
  }
  if (existing.studentId !== studentId) {
    throw new CondonationError('Forbidden', 403);
  }
  if (existing.status !== 'pending') {
    throw new CondonationError('Only pending requests can be withdrawn', 409);
  }

  return db.condonationRequest.update({
    where: { id: requestId },
    data: { status: 'withdrawn' },
  });
}

export async function countPendingCondonations(scope: CampusScope): Promise<number> {
  const where: Record<string, unknown> = { status: 'pending' };
  if (scope.level === 'department') {
    where.departmentId = scope.departmentId;
  } else if (scope.level === 'instructor') {
    const enrollments = await db.courseEnrollment.findMany({
      where: { courseId: { in: scope.courseIds }, status: 'enrolled' },
      select: { studentId: true },
      distinct: ['studentId'],
    });
    const studentIds = enrollments.map((e) => e.studentId);
    where.studentId = { in: studentIds.length > 0 ? studentIds : ['__none__'] };
  }
  return db.condonationRequest.count({ where });
}
