-- Knuct chain publish tracking + verifiable credentials (Phase 2/3 readiness)

ALTER TABLE "BlockchainAnchor" ADD COLUMN IF NOT EXISTS "lastError" TEXT;
ALTER TABLE "BlockchainAnchor" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "KnuctCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "resourceId" TEXT,
    "payloadHash" TEXT NOT NULL,
    "knuctAssetRef" TEXT,
    "verifyUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastError" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnuctCredential_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "KnuctCredential_userId_idx" ON "KnuctCredential"("userId");
CREATE INDEX IF NOT EXISTS "KnuctCredential_type_idx" ON "KnuctCredential"("type");
CREATE INDEX IF NOT EXISTS "KnuctCredential_status_idx" ON "KnuctCredential"("status");
CREATE INDEX IF NOT EXISTS "KnuctCredential_payloadHash_idx" ON "KnuctCredential"("payloadHash");

DO $$ BEGIN
  ALTER TABLE "KnuctCredential" ADD CONSTRAINT "KnuctCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
