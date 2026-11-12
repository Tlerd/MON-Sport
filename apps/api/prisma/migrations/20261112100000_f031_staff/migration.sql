-- Brief F-031: Staff accounts (UC-17, BR-55). Expand only.
-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'STAFF';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "staffVenueId" UUID;

-- CreateIndex
CREATE INDEX "User_staffVenueId_idx" ON "User"("staffVenueId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_staffVenueId_fkey" FOREIGN KEY ("staffVenueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
