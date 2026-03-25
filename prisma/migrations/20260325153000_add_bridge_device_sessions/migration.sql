CREATE TABLE "BridgeDeviceSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deviceName" TEXT,
  "platform" TEXT,
  "tokenHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "BridgeDeviceSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BridgeDeviceSession_tokenHash_key" ON "BridgeDeviceSession"("tokenHash");
CREATE INDEX "BridgeDeviceSession_userId_revokedAt_idx" ON "BridgeDeviceSession"("userId", "revokedAt");
CREATE INDEX "BridgeDeviceSession_lastSeenAt_idx" ON "BridgeDeviceSession"("lastSeenAt");

ALTER TABLE "BridgeDeviceSession"
ADD CONSTRAINT "BridgeDeviceSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
