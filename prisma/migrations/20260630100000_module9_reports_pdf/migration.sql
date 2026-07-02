-- AlterEnum
ALTER TYPE "ReportStatus" ADD VALUE IF NOT EXISTS 'PUBLISHED';
ALTER TYPE "ReportStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('DISTRIBUTION_PROOF');

-- CreateEnum
CREATE TYPE "ReportTemplate" AS ENUM ('STANDARD', 'IMMOBILIEN', 'RESTAURANT', 'FRANCHISE', 'CUSTOM_BRANDING');

-- AlterTable
ALTER TABLE "Report" RENAME COLUMN "approvedBy" TO "approvedById";

ALTER TABLE "Report" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "checksum" TEXT,
ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "downloadedAt" TIMESTAMP(3),
ADD COLUMN     "onlineUrl" TEXT,
ADD COLUMN     "reportNumber" TEXT,
ADD COLUMN     "reportType" "ReportType" NOT NULL DEFAULT 'DISTRIBUTION_PROOF',
ADD COLUMN     "template" "ReportTemplate" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "verificationCode" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

UPDATE "Report"
SET
  "customerId" = "Order"."customerId",
  "reportNumber" = CONCAT('RPT-', TO_CHAR(COALESCE("Report"."generatedAt", "Report"."createdAt"), 'YYYYMMDD'), '-', SUBSTRING("Report"."id", 1, 8)),
  "onlineUrl" = CONCAT('/customer/reports/', "Report"."id"),
  "approvedAt" = COALESCE("Report"."generatedAt", "Report"."createdAt"),
  "verificationCode" = CONCAT('VRF-', UPPER(SUBSTRING("Report"."id", 1, 10))),
  "checksum" = UPPER(SUBSTRING(MD5("Report"."id" || "Report"."orderId" || "Report"."tourId"), 1, 16))
FROM "Order"
WHERE "Report"."orderId" = "Order"."id";

ALTER TABLE "Report" ALTER COLUMN "customerId" SET NOT NULL;
ALTER TABLE "Report" ALTER COLUMN "reportNumber" SET NOT NULL;
ALTER TABLE "Report" ALTER COLUMN "verificationCode" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Report_reportNumber_key" ON "Report"("reportNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Report_verificationCode_key" ON "Report"("verificationCode");

-- CreateIndex
CREATE INDEX "Report_customerId_status_idx" ON "Report"("customerId", "status");

-- CreateIndex
CREATE INDEX "Report_reportNumber_idx" ON "Report"("reportNumber");

-- CreateIndex
CREATE INDEX "Report_verificationCode_idx" ON "Report"("verificationCode");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
