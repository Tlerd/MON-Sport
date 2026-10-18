-- Brief F-011 (UC-7, UC-8, UC-9): matches in the lobby and their players.
-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('OPEN', 'FULL', 'CANCELLED', 'FINISHED');

-- CreateEnum
CREATE TYPE "MatchPlayerStatus" AS ENUM ('ACTIVE', 'LEFT');

-- CreateTable
CREATE TABLE "Match" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "hostId" UUID NOT NULL,
    "sport" "Sport" NOT NULL,
    "capacity" INTEGER NOT NULL,
    "pricePerSlot" INTEGER NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'OPEN',
    "joinedCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchPlayer" (
    "matchId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "MatchPlayerStatus" NOT NULL,
    "joinedAt" TIMESTAMPTZ(3) NOT NULL,
    "leftAt" TIMESTAMPTZ(3),

    CONSTRAINT "MatchPlayer_pkey" PRIMARY KEY ("matchId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Match_bookingId_key" ON "Match"("bookingId");

-- CreateIndex
CREATE INDEX "Match_status_sport_idx" ON "Match"("status", "sport");

-- CreateIndex
CREATE INDEX "Match_hostId_idx" ON "Match"("hostId");

-- CreateIndex
CREATE INDEX "MatchPlayer_userId_status_idx" ON "MatchPlayer"("userId", "status");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayer" ADD CONSTRAINT "MatchPlayer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayer" ADD CONSTRAINT "MatchPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written CHECK constraint (brief F-011, AC-14, docs/requirements/data-dictionary.md):
-- capacity is 2..30, pricePerSlot is 0..10.000.000 whole VND (BR-25), and joinedCount stays within 0..capacity (BR-15).
ALTER TABLE "Match" ADD CONSTRAINT "Match_slots_and_price_check"
  CHECK ("capacity" >= 2 AND "capacity" <= 30 AND "pricePerSlot" >= 0 AND "pricePerSlot" <= 10000000 AND "joinedCount" >= 0 AND "joinedCount" <= "capacity");
