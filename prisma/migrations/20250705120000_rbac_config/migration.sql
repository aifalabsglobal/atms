-- CreateTable
CREATE TABLE IF NOT EXISTS "RbacConfig" (
    "id" TEXT NOT NULL,
    "matrix" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "RbacConfig_pkey" PRIMARY KEY ("id")
);
