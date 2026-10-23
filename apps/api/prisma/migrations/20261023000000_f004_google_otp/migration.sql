-- Brief F-004: Google login and phone verification with OTP.
-- Expand: nullable columns on User, passwordHash nullable for Google-only accounts.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "googleSub" VARCHAR(255),
ADD COLUMN     "email" VARCHAR(254),
ADD COLUMN     "phoneVerifiedAt" TIMESTAMPTZ(3),
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");

-- Brief F-004: Phone verification OTP codes.
-- CreateTable
CREATE TABLE "PhoneOtp" (
    "phoneKey" VARCHAR(64) NOT NULL,
    "purpose" VARCHAR(30) NOT NULL,
    "codeHash" CHAR(64) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PhoneOtp_pkey" PRIMARY KEY ("phoneKey","purpose")
);

-- CreateIndex
CREATE INDEX "PhoneOtp_expiresAt_idx" ON "PhoneOtp"("expiresAt");

-- Brief F-004: Dev-only outbox for OTP codes when OTP_PROVIDER is "dev".
-- CreateTable
CREATE TABLE "DevOtpOutbox" (
    "id" UUID NOT NULL,
    "phone" VARCHAR(10) NOT NULL,
    "code" CHAR(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DevOtpOutbox_pkey" PRIMARY KEY ("id")
);
