-- CreateTable
CREATE TABLE "SettingValue" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "scopeId" TEXT NOT NULL DEFAULT '',
    "value" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SettingValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettingHistory" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "scopeId" TEXT NOT NULL DEFAULT '',
    "value" JSONB NOT NULL,
    "version" INTEGER NOT NULL,
    "updatedBy" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettingFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettingFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettingRecent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "accessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettingRecent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SettingValue_key_idx" ON "SettingValue"("key");

-- CreateIndex
CREATE INDEX "SettingValue_scope_scopeId_idx" ON "SettingValue"("scope", "scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "SettingValue_key_scope_scopeId_key" ON "SettingValue"("key", "scope", "scopeId");

-- CreateIndex
CREATE INDEX "SettingHistory_key_scope_scopeId_version_idx" ON "SettingHistory"("key", "scope", "scopeId", "version");

-- CreateIndex
CREATE INDEX "SettingHistory_createdAt_idx" ON "SettingHistory"("createdAt");

-- CreateIndex
CREATE INDEX "SettingFavorite_userId_idx" ON "SettingFavorite"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SettingFavorite_userId_key_key" ON "SettingFavorite"("userId", "key");

-- CreateIndex
CREATE INDEX "SettingRecent_userId_accessedAt_idx" ON "SettingRecent"("userId", "accessedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SettingRecent_userId_key_key" ON "SettingRecent"("userId", "key");
