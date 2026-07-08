-- Knuct wallet provision requests (admin approval before create/reprovision)
CREATE TABLE "KnuctWalletProvisionRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "userNote" TEXT,
    "rejectionReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnuctWalletProvisionRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KnuctWalletProvisionRequest_status_idx" ON "KnuctWalletProvisionRequest"("status");
CREATE INDEX "KnuctWalletProvisionRequest_userId_idx" ON "KnuctWalletProvisionRequest"("userId");
CREATE INDEX "KnuctWalletProvisionRequest_createdAt_idx" ON "KnuctWalletProvisionRequest"("createdAt");

ALTER TABLE "KnuctWalletProvisionRequest" ADD CONSTRAINT "KnuctWalletProvisionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
