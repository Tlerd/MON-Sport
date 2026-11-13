-- Brief F-032 (W5, UC-19, BR-56): host rates players after a match. Expand only.
-- CreateTable
CREATE TABLE "PlayerRating" (
    "matchId" UUID NOT NULL,
    "raterId" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "stars" INTEGER,
    "noShow" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PlayerRating_pkey" PRIMARY KEY ("matchId","playerId")
);

-- CreateIndex
CREATE INDEX "PlayerRating_playerId_idx" ON "PlayerRating"("playerId");

-- AddForeignKey
ALTER TABLE "PlayerRating" ADD CONSTRAINT "PlayerRating_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerRating" ADD CONSTRAINT "PlayerRating_raterId_fkey" FOREIGN KEY ("raterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerRating" ADD CONSTRAINT "PlayerRating_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written CHECK constraints (brief F-032, AC-1, AC-6, docs/requirements/data-dictionary.md):
-- stars is 1..5 when present, and exactly one of stars or noShow is set.
ALTER TABLE "PlayerRating" ADD CONSTRAINT "PlayerRating_stars_check"
  CHECK ("stars" BETWEEN 1 AND 5);

ALTER TABLE "PlayerRating" ADD CONSTRAINT "PlayerRating_noshow_stars_check"
  CHECK (("noShow" AND "stars" IS NULL) OR (NOT "noShow" AND "stars" IS NOT NULL));
