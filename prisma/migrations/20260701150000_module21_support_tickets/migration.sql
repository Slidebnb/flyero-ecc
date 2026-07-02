-- Module 21: Reklamationen, Support-Tickets & Qualitätsprüfung

ALTER TYPE "SupportTicketStatus" ADD VALUE IF NOT EXISTS 'WAITING_INTERNAL';
ALTER TYPE "SupportTicketStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

CREATE TYPE "TicketType" AS ENUM (
  'CUSTOMER_SUPPORT',
  'COMPLAINT',
  'TOUR_ISSUE',
  'WAREHOUSE_ISSUE',
  'BILLING_ISSUE',
  'TECHNICAL_ISSUE',
  'OTHER'
);

CREATE TYPE "TicketPriority" AS ENUM (
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT'
);

CREATE TYPE "TicketMessageVisibility" AS ENUM (
  'PUBLIC',
  'INTERNAL'
);

ALTER TABLE "NumberingSettings"
  ADD COLUMN "ticketPrefix" TEXT NOT NULL DEFAULT 'FLY-TK',
  ADD COLUMN "ticketYear" INTEGER,
  ADD COLUMN "ticketNextNumber" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "SupportTicket"
  ADD COLUMN "ticketNumber" TEXT,
  ADD COLUMN "type" "TicketType" NOT NULL DEFAULT 'CUSTOMER_SUPPORT',
  ADD COLUMN "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "distributorId" TEXT,
  ADD COLUMN "tourId" TEXT,
  ADD COLUMN "reportId" TEXT,
  ADD COLUMN "warehouseInventoryId" TEXT,
  ADD COLUMN "assignedToId" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "resolution" TEXT,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "closedAt" TIMESTAMP(3);

UPDATE "SupportTicket"
SET
  "ticketNumber" = 'FLY-TK-LEGACY-' || substring("id" from 1 for 8),
  "description" = COALESCE(NULLIF("message", ''), "subject")
WHERE "ticketNumber" IS NULL OR "description" IS NULL;

ALTER TABLE "SupportTicket"
  ALTER COLUMN "ticketNumber" SET NOT NULL,
  ALTER COLUMN "description" SET NOT NULL,
  ALTER COLUMN "message" DROP NOT NULL,
  ALTER COLUMN "customerId" DROP NOT NULL;

ALTER TABLE "SupportTicket" DROP CONSTRAINT IF EXISTS "SupportTicket_customerId_fkey";

ALTER TABLE "SupportTicket"
  ADD CONSTRAINT "SupportTicket_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupportTicket"
  ADD CONSTRAINT "SupportTicket_distributorId_fkey"
  FOREIGN KEY ("distributorId") REFERENCES "DistributorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupportTicket"
  ADD CONSTRAINT "SupportTicket_tourId_fkey"
  FOREIGN KEY ("tourId") REFERENCES "DistributionTour"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupportTicket"
  ADD CONSTRAINT "SupportTicket_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupportTicket"
  ADD CONSTRAINT "SupportTicket_warehouseInventoryId_fkey"
  FOREIGN KEY ("warehouseInventoryId") REFERENCES "WarehouseInventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupportTicket"
  ADD CONSTRAINT "SupportTicket_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupportTicket"
  ADD CONSTRAINT "SupportTicket_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "SupportTicket_ticketNumber_key" ON "SupportTicket"("ticketNumber");
CREATE INDEX "SupportTicket_distributorId_status_idx" ON "SupportTicket"("distributorId", "status");
CREATE INDEX "SupportTicket_orderId_idx" ON "SupportTicket"("orderId");
CREATE INDEX "SupportTicket_tourId_idx" ON "SupportTicket"("tourId");
CREATE INDEX "SupportTicket_reportId_idx" ON "SupportTicket"("reportId");
CREATE INDEX "SupportTicket_warehouseInventoryId_idx" ON "SupportTicket"("warehouseInventoryId");
CREATE INDEX "SupportTicket_assignedToId_status_idx" ON "SupportTicket"("assignedToId", "status");
CREATE INDEX "SupportTicket_type_status_idx" ON "SupportTicket"("type", "status");
CREATE INDEX "SupportTicket_priority_status_idx" ON "SupportTicket"("priority", "status");

CREATE TABLE "TicketMessage" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "senderId" TEXT,
  "senderRole" "UserRole",
  "visibility" "TicketMessageVisibility" NOT NULL DEFAULT 'PUBLIC',
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TicketAttachment" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "messageId" TEXT,
  "fileUrl" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileType" TEXT NOT NULL,
  "uploadedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TicketAttachment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TicketMessage"
  ADD CONSTRAINT "TicketMessage_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TicketMessage"
  ADD CONSTRAINT "TicketMessage_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TicketAttachment"
  ADD CONSTRAINT "TicketAttachment_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TicketAttachment"
  ADD CONSTRAINT "TicketAttachment_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "TicketMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TicketAttachment"
  ADD CONSTRAINT "TicketAttachment_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "TicketMessage_ticketId_createdAt_idx" ON "TicketMessage"("ticketId", "createdAt");
CREATE INDEX "TicketMessage_senderId_createdAt_idx" ON "TicketMessage"("senderId", "createdAt");
CREATE INDEX "TicketMessage_visibility_idx" ON "TicketMessage"("visibility");
CREATE INDEX "TicketAttachment_ticketId_createdAt_idx" ON "TicketAttachment"("ticketId", "createdAt");
CREATE INDEX "TicketAttachment_messageId_idx" ON "TicketAttachment"("messageId");
CREATE INDEX "TicketAttachment_uploadedById_createdAt_idx" ON "TicketAttachment"("uploadedById", "createdAt");
