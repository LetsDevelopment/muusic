ALTER TABLE "NowPlaying"
  ALTER COLUMN "spotifyTrackId" DROP NOT NULL;

ALTER TABLE "NowPlaying"
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'spotify',
  ADD COLUMN "bridgeMode" TEXT,
  ADD COLUMN "externalUrl" TEXT;

CREATE TABLE "UserMusicHistory" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "spotifyTrackId" TEXT,
  "trackName" TEXT NOT NULL,
  "artistName" TEXT NOT NULL,
  "albumImageUrl" TEXT,
  "source" TEXT NOT NULL DEFAULT 'spotify',
  "bridgeMode" TEXT,
  "externalUrl" TEXT,
  "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserMusicHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserMusicHistory_userId_playedAt_idx" ON "UserMusicHistory"("userId", "playedAt");
CREATE INDEX "UserMusicHistory_playedAt_idx" ON "UserMusicHistory"("playedAt");
CREATE INDEX "UserMusicHistory_spotifyTrackId_idx" ON "UserMusicHistory"("spotifyTrackId");

ALTER TABLE "UserMusicHistory"
  ADD CONSTRAINT "UserMusicHistory_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
