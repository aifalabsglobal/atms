ALTER TABLE "KnuctRegistrationRequest" ADD COLUMN IF NOT EXISTS "privShareEnc" BYTEA;
ALTER TABLE "KnuctRegistrationRequest" ADD COLUMN IF NOT EXISTS "walletSource" TEXT NOT NULL DEFAULT 'existing';
