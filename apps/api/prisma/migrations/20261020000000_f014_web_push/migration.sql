-- Brief F-014 (UC-14): Web Push.
-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "pushedAt" TIMESTAMPTZ(3);

-- Notifications that exist before this migration stay quiet: the sender never pushes an old row.
UPDATE "Notification" SET "pushedAt" = "createdAt";

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "endpoint" VARCHAR(2048) NOT NULL,
    "p256dh" VARCHAR(200) NOT NULL,
    "auth" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_createdAt_idx" ON "PushSubscription"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Notify the 'push' channel with the id of each new Notification row (ADR 0004). The payload holds the id and nothing else.
CREATE OR REPLACE FUNCTION notification_notify_push() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('push', NEW."id"::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Notification_notify_push"
  AFTER INSERT ON "Notification"
  FOR EACH ROW
  EXECUTE FUNCTION notification_notify_push();
