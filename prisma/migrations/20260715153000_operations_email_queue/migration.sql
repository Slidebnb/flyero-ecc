ALTER TABLE "NotificationMessage" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "NotificationQueue" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "NotificationQueue" ADD COLUMN "recipientEmail" TEXT;

CREATE INDEX "NotificationQueue_recipientEmail_status_idx" ON "NotificationQueue"("recipientEmail", "status");
