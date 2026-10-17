-- Brief F-006: the session guard refuses a cookie issued before this time. The admin unlock sets it.
-- Null for existing rows, so the sessions that exist at deploy time stay valid.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sessionsValidFrom" TIMESTAMPTZ(3);

-- Brief F-006 (BR-30): fixed-window counters of login and sign-up attempts, shared by every API instance.
-- CreateTable
CREATE TABLE "AuthThrottle" (
    "key" VARCHAR(100) NOT NULL,
    "count" INTEGER NOT NULL,
    "windowStart" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AuthThrottle_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "AuthThrottle_windowStart_idx" ON "AuthThrottle"("windowStart");
