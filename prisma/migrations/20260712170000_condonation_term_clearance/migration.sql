-- AlterTable
ALTER TABLE "CondonationRequest" ADD COLUMN "clearedForTerm" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CondonationRequest" ADD COLUMN "clearedAt" TIMESTAMP(3);
ALTER TABLE "CondonationRequest" ADD COLUMN "academicYearId" TEXT;

-- CreateIndex
CREATE INDEX "CondonationRequest_clearedForTerm_idx" ON "CondonationRequest"("clearedForTerm");
CREATE INDEX "CondonationRequest_academicYearId_idx" ON "CondonationRequest"("academicYearId");

-- AddForeignKey
ALTER TABLE "CondonationRequest" ADD CONSTRAINT "CondonationRequest_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;
