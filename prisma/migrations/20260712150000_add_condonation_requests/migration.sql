-- CreateTable
CREATE TABLE "CondonationRequest" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "departmentId" TEXT,
    "attendancePct" DOUBLE PRECISION NOT NULL,
    "eligibilityPct" DOUBLE PRECISION NOT NULL,
    "condonationPct" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "supportingDocUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CondonationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CondonationRequest_status_idx" ON "CondonationRequest"("status");

-- CreateIndex
CREATE INDEX "CondonationRequest_studentId_idx" ON "CondonationRequest"("studentId");

-- CreateIndex
CREATE INDEX "CondonationRequest_departmentId_idx" ON "CondonationRequest"("departmentId");

-- CreateIndex
CREATE INDEX "CondonationRequest_createdAt_idx" ON "CondonationRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "CondonationRequest" ADD CONSTRAINT "CondonationRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CondonationRequest" ADD CONSTRAINT "CondonationRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
