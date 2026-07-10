-- CreateEnum
CREATE TYPE "ReportSource" AS ENUM ('EXTERNAL_GPS_REPORT', 'MANUAL_EVIDENCE', 'INTERNAL_TRACKING', 'HYBRID');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "customerVisible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "externalReportReference" TEXT,
ADD COLUMN     "providerName" TEXT,
ADD COLUMN     "reportDate" TIMESTAMP(3),
ADD COLUMN     "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "reportSource" "ReportSource" NOT NULL DEFAULT 'INTERNAL_TRACKING';

-- CreateTable
CREATE TABLE "ManualDistributor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "region" TEXT,
    "vehicle" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "compensationType" TEXT,
    "reliabilityNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualDistributor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManualDistributor_isActive_region_idx" ON "ManualDistributor"("isActive", "region");

-- CreateIndex
CREATE INDEX "ManualDistributor_name_idx" ON "ManualDistributor"("name");

-- CreateIndex
CREATE INDEX "Document_orderId_customerVisible_idx" ON "Document"("orderId", "customerVisible");

-- CreateIndex
CREATE INDEX "Document_providerName_reportDate_idx" ON "Document"("providerName", "reportDate");
