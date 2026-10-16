-- Brief F-003: when the user agreed to the privacy notice at sign-up.
-- Null for accounts that an admin or the seed created, so existing rows stay valid.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "consentAt" TIMESTAMPTZ(3);

-- Hand-written: Prisma has no CHECK in its schema. The admin edits venues and courts with PATCH,
-- so the database is the last guard for the rules of docs/requirements/data-dictionary.md.
-- Opening hours: minutes since 00:00 on the 30-minute grid, and the venue closes after it opens on the same day.
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_hours_check"
  CHECK ("opensAt" >= 0 AND "closesAt" <= 1440 AND "closesAt" > "opensAt" AND "opensAt" % 30 = 0 AND "closesAt" % 30 = 0);

-- Prices are positive whole VND (BR-25), at most 10.000.000 per hour, so a booking total fits in int4.
ALTER TABLE "Court" ADD CONSTRAINT "Court_prices_check"
  CHECK ("priceNormal" > 0 AND "pricePeak" > 0 AND "priceNormal" <= 10000000 AND "pricePeak" <= 10000000);
