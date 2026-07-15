ALTER TABLE "AutoDispatchRecommendation"
ADD COLUMN "segmentId" TEXT;

DROP INDEX IF EXISTS "AutoDispatchRecommendation_orderId_distributorId_key";

CREATE UNIQUE INDEX "AutoDispatchRecommendation_orderId_distributorId_segmentId_key"
ON "AutoDispatchRecommendation"("orderId", "distributorId", "segmentId");

CREATE INDEX "AutoDispatchRecommendation_segmentId_status_idx"
ON "AutoDispatchRecommendation"("segmentId", "status");

ALTER TABLE "AutoDispatchRecommendation"
ADD CONSTRAINT "AutoDispatchRecommendation_segmentId_fkey"
FOREIGN KEY ("segmentId") REFERENCES "OrderDistributionSegment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
