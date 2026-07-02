-- Module 13: accounting export runs for invoices, payments and credit notes.

CREATE TYPE "AccountingExportType" AS ENUM ('INVOICES', 'PAYMENTS', 'CREDIT_NOTES', 'FULL_ACCOUNTING');
CREATE TYPE "AccountingExportStatus" AS ENUM ('DRAFT', 'GENERATING', 'COMPLETED', 'FAILED', 'ARCHIVED');
CREATE TYPE "AccountingExportFormat" AS ENUM ('CSV_LEXWARE', 'CSV_DATEV', 'CSV_GENERIC');

CREATE TABLE "AccountingExport" (
  "id" TEXT NOT NULL,
  "exportNumber" TEXT NOT NULL,
  "type" "AccountingExportType" NOT NULL,
  "status" "AccountingExportStatus" NOT NULL DEFAULT 'DRAFT',
  "format" "AccountingExportFormat" NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  "fileUrl" TEXT,
  "rowCount" INTEGER NOT NULL DEFAULT 0,
  "checksum" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "AccountingExport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountingExportItem" (
  "id" TEXT NOT NULL,
  "exportId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'EXPORTED',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountingExportItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountingExport_exportNumber_key" ON "AccountingExport"("exportNumber");
CREATE INDEX "AccountingExport_type_status_idx" ON "AccountingExport"("type", "status");
CREATE INDEX "AccountingExport_periodStart_periodEnd_idx" ON "AccountingExport"("periodStart", "periodEnd");
CREATE INDEX "AccountingExport_createdById_createdAt_idx" ON "AccountingExport"("createdById", "createdAt");
CREATE INDEX "AccountingExportItem_exportId_idx" ON "AccountingExportItem"("exportId");
CREATE INDEX "AccountingExportItem_entityType_entityId_idx" ON "AccountingExportItem"("entityType", "entityId");
CREATE INDEX "AccountingExportItem_status_idx" ON "AccountingExportItem"("status");

ALTER TABLE "AccountingExport" ADD CONSTRAINT "AccountingExport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountingExportItem" ADD CONSTRAINT "AccountingExportItem_exportId_fkey" FOREIGN KEY ("exportId") REFERENCES "AccountingExport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
