-- Module 14: rule-based auto dispatch recommendations.

CREATE TYPE "AutoDispatchRecommendationStatus" AS ENUM ('SUGGESTED', 'SELECTED', 'DISMISSED', 'EXPIRED');

ALTER TABLE "SystemSettings"
ADD COLUMN "autoDispatchEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "autoDispatchMinScore" INTEGER NOT NULL DEFAULT 85;

CREATE TABLE "AutoDispatchRecommendation" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "distributorId" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "reasons" JSONB NOT NULL,
  "warnings" JSONB NOT NULL,
  "status" "AutoDispatchRecommendationStatus" NOT NULL DEFAULT 'SUGGESTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutoDispatchRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AutoDispatchRecommendation_orderId_distributorId_key" ON "AutoDispatchRecommendation"("orderId", "distributorId");
CREATE INDEX "AutoDispatchRecommendation_orderId_status_idx" ON "AutoDispatchRecommendation"("orderId", "status");
CREATE INDEX "AutoDispatchRecommendation_distributorId_status_idx" ON "AutoDispatchRecommendation"("distributorId", "status");
CREATE INDEX "AutoDispatchRecommendation_score_idx" ON "AutoDispatchRecommendation"("score");

ALTER TABLE "AutoDispatchRecommendation" ADD CONSTRAINT "AutoDispatchRecommendation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutoDispatchRecommendation" ADD CONSTRAINT "AutoDispatchRecommendation_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "DistributorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
