-- Brief F-030: recurring bookings seriesId
ALTER TABLE "Booking" ADD COLUMN "seriesId" UUID;
CREATE INDEX "Booking_seriesId_idx" ON "Booking"("seriesId");
