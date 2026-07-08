import { db } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { anchorResource } from '@/lib/knuct/anchor-service';
import { createKnuctWalletBundle } from '@/lib/knuct/wallet-service';
import { placeholderRegistrationDid } from '@/lib/knuct/wallet-provision-request-service';
import {
  ALL_ROLES,
  canAssignRole,
} from '@/lib/user-management';
import type { Role } from '@/lib/store';

export type RegistrationProfile = {
  name: string;
  email: string;
  employeeId?: string;
  phone?: string;
  departmentId?: string;
  department?: string;
  requestedRole?: string;
};

export async function assertDidAvailableForRegistration(did: string): Promise<string | null> {
  const [wallet, pending] = await Promise.all([
    db.knuctWallet.findFirst({ where: { did }, select: { id: true } }),
    db.knuctRegistrationRequest.findFirst({
      where: { did, status: 'pending' },
      select: { id: true },
    }),
  ]);

  if (wallet) return 'This DID is already linked to an account.';
  if (pending) return 'A registration request for this DID is already pending review.';
  return null;
}

export async function validateRegistrationProfile(profile: RegistrationProfile) {
  const email = profile.email.trim().toLowerCase();
  const name = profile.name.trim();
  const requestedRole = profile.requestedRole?.trim() || 'student';

  if (!email || !name) {
    throw new Error('Name and email are required.');
  }
  if (!ALL_ROLES.includes(requestedRole as Role)) {
    throw new Error('Invalid requested role.');
  }
  if (!['student', 'faculty', 'lab_assistant', 'visitor', 'parent'].includes(requestedRole)) {
    throw new Error('Self-registration is only available for student, faculty, lab assistant, parent, or visitor roles.');
  }

  const existingEmail = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existingEmail) throw new Error('An account with this email already exists.');

  const pendingEmail = await db.knuctRegistrationRequest.findFirst({
    where: { email, status: 'pending' },
    select: { id: true },
  });
  if (pendingEmail) throw new Error('A registration request with this email is already pending review.');

  const employeeId = profile.employeeId?.trim() || null;
  if (employeeId) {
    const existingEmp = await db.user.findUnique({ where: { employeeId }, select: { id: true } });
    if (existingEmp) throw new Error('This employee / roll number is already registered.');
  }

  let department = profile.department?.trim() || null;
  const departmentId = profile.departmentId?.trim() || null;
  if (departmentId) {
    const dept = await db.department.findUnique({
      where: { id: departmentId },
      select: { name: true },
    });
    if (dept) department = dept.name;
  }

  return { email, name, employeeId, department, departmentId, requestedRole, phone: profile.phone?.trim() || null };
}

export type RegistrationWalletSource = 'existing' | 'created' | 'pending_create';

export async function createRegistrationRequest(
  did: string,
  profile: RegistrationProfile,
  opts?: { privShareEnc?: Uint8Array; walletSource?: RegistrationWalletSource }
) {
  const didError = await assertDidAvailableForRegistration(did);
  if (didError) throw new Error(didError);

  const validated = await validateRegistrationProfile(profile);

  return db.knuctRegistrationRequest.create({
    data: {
      did,
      email: validated.email,
      name: validated.name,
      employeeId: validated.employeeId,
      phone: validated.phone,
      departmentId: validated.departmentId,
      department: validated.department,
      requestedRole: validated.requestedRole,
      status: 'pending',
      privShareEnc: opts?.privShareEnc ? Buffer.from(opts.privShareEnc) : undefined,
      walletSource: opts?.walletSource ?? 'existing',
    },
  });
}

export async function createRegistrationPendingWallet(profile: RegistrationProfile) {
  await validateRegistrationProfile(profile);
  const placeholderDid = placeholderRegistrationDid();

  const didError = await assertDidAvailableForRegistration(placeholderDid);
  if (didError) throw new Error(didError);

  const request = await createRegistrationRequest(placeholderDid, profile, {
    walletSource: 'pending_create',
  });

  return {
    request,
    message:
      'Registration submitted. An administrator will review your profile and create your Knuct wallet upon approval.',
  };
}

/** @deprecated Use createRegistrationPendingWallet — wallet is created on admin approval. */
export async function createRegistrationWithNewWallet(profile: RegistrationProfile) {
  return createRegistrationPendingWallet(profile);
}

export async function listRegistrationRequests(status = 'pending') {
  return db.knuctRegistrationRequest.findMany({
    where: { status },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

export async function approveRegistrationRequest(params: {
  requestId: string;
  reviewerId: string;
  reviewerRole: Role;
  role?: Role;
  departmentId?: string | null;
  department?: string | null;
}) {
  const request = await db.knuctRegistrationRequest.findUnique({ where: { id: params.requestId } });
  if (!request || request.status !== 'pending') {
    throw new Error('Registration request not found or already reviewed.');
  }

  const assignedRole = (params.role ?? request.requestedRole) as Role;
  if (!canAssignRole(params.reviewerRole, assignedRole)) {
    throw new Error('You cannot approve this role.');
  }

  if (params.reviewerRole === 'hod') {
    if (!['student', 'faculty', 'lab_assistant'].includes(assignedRole)) {
      throw new Error('HOD can only approve student, faculty, or lab assistant registrations.');
    }
    const hod = await db.user.findUnique({
      where: { id: params.reviewerId },
      select: { departmentId: true },
    });
    if (hod?.departmentId && request.departmentId && hod.departmentId !== request.departmentId) {
      throw new Error('This registration is outside your department.');
    }
  }

  const existingUser = await db.user.findUnique({ where: { email: request.email }, select: { id: true } });
  if (existingUser) throw new Error('An account with this email already exists.');

  const didTaken = await db.knuctWallet.findFirst({ where: { did: request.did }, select: { id: true } });
  if (didTaken && request.walletSource !== 'pending_create') {
    throw new Error('This DID is already linked to an account.');
  }

  let did = request.did;
  let privShareEnc: Uint8Array | undefined = request.privShareEnc
    ? new Uint8Array(request.privShareEnc)
    : undefined;

  if (request.walletSource === 'pending_create' || !privShareEnc) {
    const bundle = await createKnuctWalletBundle();
    const liveDidTaken = await db.knuctWallet.findFirst({ where: { did: bundle.did }, select: { id: true } });
    if (liveDidTaken) throw new Error('Generated DID collision — try approving again.');
    did = bundle.did;
    privShareEnc = new Uint8Array(bundle.privShareEnc);
  } else {
    const didTakenLive = await db.knuctWallet.findFirst({ where: { did: request.did }, select: { id: true } });
    if (didTakenLive) throw new Error('This DID is already linked to an account.');
  }

  let department = params.department ?? request.department;
  let departmentId = params.departmentId ?? request.departmentId;
  if (departmentId) {
    const dept = await db.department.findUnique({
      where: { id: departmentId },
      select: { name: true },
    });
    if (dept) department = dept.name;
  }

  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: request.email,
        name: request.name,
        role: assignedRole,
        department,
        departmentId,
        phone: request.phone,
        employeeId: request.employeeId,
        status: 'active',
        passwordHash: '$2a$10$placeholder',
      },
    });

    await tx.knuctWallet.create({
      data: {
        userId: created.id,
        did,
        privShareEnc: privShareEnc ? Buffer.from(privShareEnc) : undefined,
        status: 'active',
      },
    });

    await tx.knuctRegistrationRequest.update({
      where: { id: request.id },
      data: {
        status: 'approved',
        did,
        reviewedById: params.reviewerId,
        reviewedAt: new Date(),
        approvedUserId: created.id,
        requestedRole: assignedRole,
        department,
        departmentId,
        walletSource: privShareEnc ? 'created' : request.walletSource,
        privShareEnc: privShareEnc ? Buffer.from(privShareEnc) : undefined,
      },
    });

    return created;
  });

  await logAudit({
    userId: params.reviewerId,
    action: 'user.create',
    resource: `registration:${request.id}`,
    details: {
      approvedUserId: user.id,
      email: user.email,
      role: assignedRole,
      did: did.slice(0, 24),
      method: 'knuct_registration',
    },
  });

  await anchorResource('subject_publish', user.id, {
    event: 'knuct_registration_approved',
    userId: user.id,
    email: user.email,
    role: assignedRole,
    did,
    registrationRequestId: request.id,
  }).catch(() => null);

  return user;
}

export async function rejectRegistrationRequest(params: {
  requestId: string;
  reviewerId: string;
  reason?: string;
}) {
  const request = await db.knuctRegistrationRequest.findUnique({ where: { id: params.requestId } });
  if (!request || request.status !== 'pending') {
    throw new Error('Registration request not found or already reviewed.');
  }

  await db.knuctRegistrationRequest.update({
    where: { id: params.requestId },
    data: {
      status: 'rejected',
      reviewedById: params.reviewerId,
      reviewedAt: new Date(),
      rejectionReason: params.reason?.trim() || 'Rejected by administrator',
    },
  });

  await logAudit({
    userId: params.reviewerId,
    action: 'user.update',
    resource: `registration:${request.id}`,
    details: {
      action: 'rejected',
      email: request.email,
      did: request.did.slice(0, 24),
    },
  });
}
