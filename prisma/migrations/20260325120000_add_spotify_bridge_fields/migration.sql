ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "spotifyBridgeKey" TEXT,
ADD COLUMN IF NOT EXISTS "spotifyBridgeConnectedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_spotifyBridgeConnectedAt_idx"
ON "User"("spotifyBridgeConnectedAt");
