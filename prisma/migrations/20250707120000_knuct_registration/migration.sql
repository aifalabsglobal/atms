-- Knuct self-registration requests (pending admin approval)
CREATE TABLE "KnuctRegistrationRequest" (
    "id" TEXT NOT NULL,
    "did" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "employeeId" TEXT,
    "phone" TEXT,
    "departmentId" TEXT,
    "department" TEXT,
    "requestedRole" TEXT NOT NULL DEFAULT 'student',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnuctRegistrationRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KnuctRegistrationRequest_did_key" ON "KnuctRegistrationRequest"("did");
CREATE UNIQUE INDEX "KnuctRegistrationRequest_approvedUserId_key" ON "KnuctRegistrationRequest"("approvedUserId");
CREATE INDEX "KnuctRegistrationRequest_status_idx" ON "KnuctRegistrationRequest"("status");
CREATE INDEX "KnuctRegistrationRequest_email_idx" ON "KnuctRegistrationRequest"("email");
CREATE INDEX "KnuctRegistrationRequest_createdAt_idx" ON "KnuctRegistrationRequest"("createdAt");

CREATE INDEX "KnuctWallet_did_idx" ON "KnuctWallet"("did");
