ALTER TABLE "DistributionArea" ADD COLUMN "officialRegionCode" TEXT;

CREATE INDEX "DistributionArea_officialRegionCode_idx" ON "DistributionArea"("officialRegionCode");
