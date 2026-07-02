-- Module 20: CRM / Leadpipeline

ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'OFFER_SENT';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'TEST_ORDER_PLANNED';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

CREATE TYPE "LeadPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

ALTER TABLE "Lead"
  ADD COLUMN "priority" "LeadPriority" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "sourceCampaign" TEXT,
  ADD COLUMN "assignedToId" TEXT,
  ADD COLUMN "nextFollowUpAt" TIMESTAMP(3),
  ADD COLUMN "lastContactedAt" TIMESTAMP(3),
  ADD COLUMN "estimatedOrderVolume" DECIMAL(12,2),
  ADD COLUMN "expectedFlyerQuantity" INTEGER,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "lostReason" TEXT,
  ADD COLUMN "wonCustomerId" TEXT;

ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_wonCustomerId_fkey"
  FOREIGN KEY ("wonCustomerId") REFERENCES "CustomerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "LeadNote" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "authorId" TEXT,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LeadNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadActivity" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "actorId" TEXT,
  "event" TEXT NOT NULL,
  "fromStatus" "LeadStatus",
  "toStatus" "LeadStatus",
  "detail" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "LeadNote"
  ADD CONSTRAINT "LeadNote_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeadNote"
  ADD CONSTRAINT "LeadNote_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeadActivity"
  ADD CONSTRAINT "LeadActivity_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeadActivity"
  ADD CONSTRAINT "LeadActivity_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Lead_priority_status_idx" ON "Lead"("priority", "status");
CREATE INDEX "Lead_assignedToId_idx" ON "Lead"("assignedToId");
CREATE INDEX "Lead_nextFollowUpAt_idx" ON "Lead"("nextFollowUpAt");
CREATE INDEX "Lead_wonCustomerId_idx" ON "Lead"("wonCustomerId");
CREATE INDEX "LeadNote_leadId_createdAt_idx" ON "LeadNote"("leadId", "createdAt");
CREATE INDEX "LeadNote_authorId_createdAt_idx" ON "LeadNote"("authorId", "createdAt");
CREATE INDEX "LeadActivity_leadId_createdAt_idx" ON "LeadActivity"("leadId", "createdAt");
CREATE INDEX "LeadActivity_event_createdAt_idx" ON "LeadActivity"("event", "createdAt");
CREATE INDEX "LeadActivity_actorId_createdAt_idx" ON "LeadActivity"("actorId", "createdAt");
