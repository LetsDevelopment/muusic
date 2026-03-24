ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "lastfmUsername" TEXT,
ADD COLUMN IF NOT EXISTS "lastfmSessionKey" TEXT,
ADD COLUMN IF NOT EXISTS "lastfmConnectedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "musicProvider" TEXT,
ADD COLUMN IF NOT EXISTS "onboardingMusicCompleted" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "User_lastfmUsername_idx" ON "User"("lastfmUsername");
