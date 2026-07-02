CREATE TYPE "NotificationAudience" AS ENUM ('CUSTOMER', 'DISTRIBUTOR', 'ADMIN', 'INTERNAL');

CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'WHATSAPP', 'SMS', 'PUSH');

CREATE TYPE "NotificationQueueStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'RETRY');

CREATE TABLE "NotificationTemplate" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "audience" "NotificationAudience" NOT NULL,
  "channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL',
  "name" TEXT NOT NULL,
  "description" TEXT,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "placeholders" TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationMessage" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "templateId" TEXT,
  "type" TEXT NOT NULL,
  "audience" "NotificationAudience" NOT NULL,
  "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "data" JSONB,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationQueue" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "templateId" TEXT,
  "userId" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "status" "NotificationQueueStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "provider" TEXT,
  "providerMessageId" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationQueue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationLog" (
  "id" TEXT NOT NULL,
  "messageId" TEXT,
  "queueId" TEXT,
  "templateId" TEXT,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "status" "NotificationQueueStatus",
  "detail" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationTemplate_key_key" ON "NotificationTemplate"("key");
CREATE INDEX "NotificationTemplate_audience_channel_isActive_idx" ON "NotificationTemplate"("audience", "channel", "isActive");
CREATE INDEX "NotificationTemplate_key_idx" ON "NotificationTemplate"("key");

CREATE INDEX "NotificationMessage_userId_readAt_idx" ON "NotificationMessage"("userId", "readAt");
CREATE INDEX "NotificationMessage_type_createdAt_idx" ON "NotificationMessage"("type", "createdAt");
CREATE INDEX "NotificationMessage_audience_channel_createdAt_idx" ON "NotificationMessage"("audience", "channel", "createdAt");

CREATE INDEX "NotificationQueue_status_scheduledAt_idx" ON "NotificationQueue"("status", "scheduledAt");
CREATE INDEX "NotificationQueue_userId_status_idx" ON "NotificationQueue"("userId", "status");
CREATE INDEX "NotificationQueue_channel_status_idx" ON "NotificationQueue"("channel", "status");

CREATE UNIQUE INDEX "NotificationPreference_userId_type_channel_key" ON "NotificationPreference"("userId", "type", "channel");
CREATE INDEX "NotificationPreference_userId_enabled_idx" ON "NotificationPreference"("userId", "enabled");

CREATE INDEX "NotificationLog_messageId_createdAt_idx" ON "NotificationLog"("messageId", "createdAt");
CREATE INDEX "NotificationLog_queueId_createdAt_idx" ON "NotificationLog"("queueId", "createdAt");
CREATE INDEX "NotificationLog_templateId_createdAt_idx" ON "NotificationLog"("templateId", "createdAt");
CREATE INDEX "NotificationLog_userId_createdAt_idx" ON "NotificationLog"("userId", "createdAt");
CREATE INDEX "NotificationLog_action_createdAt_idx" ON "NotificationLog"("action", "createdAt");

ALTER TABLE "NotificationMessage" ADD CONSTRAINT "NotificationMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationMessage" ADD CONSTRAINT "NotificationMessage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "NotificationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NotificationQueue" ADD CONSTRAINT "NotificationQueue_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "NotificationMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationQueue" ADD CONSTRAINT "NotificationQueue_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "NotificationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationQueue" ADD CONSTRAINT "NotificationQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "NotificationMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "NotificationQueue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "NotificationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
