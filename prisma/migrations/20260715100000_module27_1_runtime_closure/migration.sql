-- Module 27.1: preserve the selected segment through dispatch.
-- The enum addition is idempotent so this migration remains safe on databases
-- that already received the value through an earlier deployment.
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'ACCEPTED_AWAITING_PAYMENT';

ALTER TABLE "DispatchAssignment"
ADD COLUMN "segmentId" TEXT;

CREATE INDEX "DispatchAssignment_segmentId_status_idx"
ON "DispatchAssignment"("segmentId", "status");

ALTER TABLE "DispatchAssignment"
ADD CONSTRAINT "DispatchAssignment_segmentId_fkey"
FOREIGN KEY ("segmentId") REFERENCES "OrderDistributionSegment"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
