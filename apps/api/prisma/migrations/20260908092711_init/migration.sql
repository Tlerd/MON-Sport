-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PLAYER', 'ORGANIZER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Sport" AS ENUM ('FOOTBALL', 'BADMINTON', 'VOLLEYBALL', 'PICKLEBALL');

-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('NEW', 'AVERAGE', 'GOOD', 'STRONG');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('OPEN', 'FULL', 'CANCELLED', 'FINISHED');

-- CreateEnum
CREATE TYPE "Format" AS ENUM ('ROUND_ROBIN', 'KNOCKOUT', 'GROUP_KNOCKOUT');

-- CreateEnum
CREATE TYPE "TStatus" AS ENUM ('DRAFT', 'REGISTERING', 'DRAWN', 'RUNNING', 'FINISHED');

-- CreateEnum
CREATE TYPE "TeamStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Stage" AS ENUM ('GROUP', 'KNOCKOUT');

-- CreateEnum
CREATE TYPE "FixtureStatus" AS ENUM ('SCHEDULED', 'LIVE', 'FINISHED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('GOAL', 'OWN_GOAL', 'YELLOW', 'RED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "zaloId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'PLAYER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerSkill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sport" "Sport" NOT NULL,
    "level" "SkillLevel" NOT NULL,

    CONSTRAINT "PlayerSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commune" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "sports" "Sport"[],
    "pricePerHour" INTEGER NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Court" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sport" "Sport" NOT NULL,

    CONSTRAINT "Court_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "sport" "Sport" NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "pricePerSlot" INTEGER NOT NULL,
    "minLevel" "SkillLevel",
    "maxLevel" "SkillLevel",
    "note" TEXT,
    "status" "MatchStatus" NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchEntry" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sport" "Sport" NOT NULL,
    "commune" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "format" "Format" NOT NULL,
    "teamLimit" INTEGER NOT NULL,
    "groupCount" INTEGER,
    "advancePerGroup" INTEGER,
    "regOpenAt" TIMESTAMP(3) NOT NULL,
    "regCloseAt" TIMESTAMP(3) NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "rules" TEXT,
    "drawSeed" INTEGER,
    "winPoints" INTEGER NOT NULL DEFAULT 3,
    "drawPoints" INTEGER NOT NULL DEFAULT 1,
    "losePoints" INTEGER NOT NULL DEFAULT 0,
    "status" "TStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "captainName" TEXT NOT NULL,
    "captainPhone" TEXT NOT NULL,
    "seed" INTEGER,
    "status" "TeamStatus" NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "groupId" TEXT,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" INTEGER,
    "birthYear" INTEGER,
    "userId" TEXT,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fixture" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "groupId" TEXT,
    "round" INTEGER NOT NULL,
    "stage" "Stage" NOT NULL,
    "order" INTEGER NOT NULL,
    "homeTeamId" TEXT,
    "awayTeamId" TEXT,
    "homeSourceFixtureId" TEXT,
    "awaySourceFixtureId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "courtId" TEXT,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "winnerTeamId" TEXT,
    "note" TEXT,
    "status" "FixtureStatus" NOT NULL DEFAULT 'SCHEDULED',

    CONSTRAINT "Fixture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchEvent" (
    "id" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "minute" INTEGER,
    "type" "EventType" NOT NULL,

    CONSTRAINT "MatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_zaloId_key" ON "User"("zaloId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerSkill_userId_sport_key" ON "PlayerSkill"("userId", "sport");

-- CreateIndex
CREATE INDEX "Match_startAt_sport_idx" ON "Match"("startAt", "sport");

-- CreateIndex
CREATE UNIQUE INDEX "MatchEntry_matchId_userId_key" ON "MatchEntry"("matchId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_slug_key" ON "Tournament"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Team_tournamentId_name_key" ON "Team"("tournamentId", "name");

-- AddForeignKey
ALTER TABLE "PlayerSkill" ADD CONSTRAINT "PlayerSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Court" ADD CONSTRAINT "Court_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEntry" ADD CONSTRAINT "MatchEntry_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEntry" ADD CONSTRAINT "MatchEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
