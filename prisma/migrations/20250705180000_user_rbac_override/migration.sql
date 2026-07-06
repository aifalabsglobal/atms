-- User-level RBAC overrides (grant/revoke sections beyond role matrix)
CREATE TABLE "UserRbacOverride" (
    "userId" TEXT NOT NULL,
    "grant" JSONB NOT NULL DEFAULT '[]',
    "revoke" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "UserRbacOverride_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "UserRbacOverride" ADD CONSTRAINT "UserRbacOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
