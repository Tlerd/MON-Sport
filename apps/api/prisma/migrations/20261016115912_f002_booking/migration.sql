-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'OWNER', 'USER');

-- CreateEnum
CREATE TYPE "Sport" AS ENUM ('FOOTBALL', 'BADMINTON');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('APP', 'PHONE');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(10) NOT NULL,
    "passwordHash" VARCHAR(200) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "lockedAt" TIMESTAMPTZ(3),
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venue" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "address" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(10) NOT NULL,
    "opensAt" INTEGER NOT NULL,
    "closesAt" INTEGER NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Court" (
    "id" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "sport" "Sport" NOT NULL,
    "priceNormal" INTEGER NOT NULL,
    "pricePeak" INTEGER NOT NULL,

    CONSTRAINT "Court_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" UUID NOT NULL,
    "courtId" UUID NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "BookingStatus" NOT NULL,
    "source" "BookingSource" NOT NULL,
    "createdById" UUID NOT NULL,
    "customerName" VARCHAR(100),
    "customerPhone" VARCHAR(10),
    "priceTotal" INTEGER NOT NULL,
    "paidAtVenue" BOOLEAN NOT NULL DEFAULT false,
    "confirmDeadline" TIMESTAMPTZ(3),
    "confirmedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Court_venueId_name_key" ON "Court"("venueId", "name");

-- CreateIndex
CREATE INDEX "Booking_courtId_status_idx" ON "Booking"("courtId", "status");

-- CreateIndex
CREATE INDEX "Booking_createdById_idx" ON "Booking"("createdById");

-- AddForeignKey
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Court" ADD CONSTRAINT "Court_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written part (brief F-002, BR-1). Prisma cannot express these constraints.
-- Lets the plain column "courtId" share a gist index with a time range.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- The end comes after the start.
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_end_after_start" CHECK ("endAt" > "startAt");

-- Two live bookings on one court never overlap. '[)' lets 19:00-20:00 and 20:00-21:00 both exist.
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_no_overlap"
  EXCLUDE USING gist ("courtId" WITH =, tstzrange("startAt", "endAt", '[)') WITH &&)
  WHERE ("status" IN ('PENDING', 'CONFIRMED'));
