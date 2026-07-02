-- Module 22: Dokumentenmanagement, Datei-Uploads und Druckaufträge

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_DISTRIBUTION';

CREATE TYPE "DocumentType" AS ENUM (
  'FLYER_PDF',
  'PRINT_FILE',
  'INDESIGN',
  'ILLUSTRATOR',
  'LOGO',
  'IMAGE',
  'ZIP',
  'REPORT',
  'INVOICE',
  'CONTRACT',
  'OTHER'
);

CREATE TYPE "DocumentStatus" AS ENUM (
  'UPLOADED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'ARCHIVED'
);

CREATE TYPE "DocumentCommentVisibility" AS ENUM (
  'PUBLIC',
  'INTERNAL'
);

CREATE TYPE "PrintStatus" AS ENUM (
  'REQUESTED',
  'APPROVED',
  'IN_PRODUCTION',
  'SHIPPED',
  'DELIVERED',
  'RECEIVED_IN_WAREHOUSE',
  'READY_FOR_DISTRIBUTION',
  'CANCELLED'
);

CREATE TABLE "DocumentFolder" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DocumentFolder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Document" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "folderId" TEXT,
  "documentType" "DocumentType" NOT NULL,
  "title" TEXT NOT NULL,
  "originalFilename" TEXT NOT NULL,
  "storedFilename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "extension" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "checksum" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
  "uploadedById" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectedReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentVersion" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "checksum" TEXT NOT NULL,
  "uploadedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentComment" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "userId" TEXT,
  "visibility" "DocumentCommentVisibility" NOT NULL DEFAULT 'PUBLIC',
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DocumentComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrintPartner" (
  "id" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "contactName" TEXT,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "address" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PrintPartner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrintOrder" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "printerId" TEXT,
  "warehouseInventoryId" TEXT,
  "status" "PrintStatus" NOT NULL DEFAULT 'REQUESTED',
  "printFormat" TEXT NOT NULL,
  "paperType" TEXT NOT NULL,
  "paperWeight" INTEGER NOT NULL,
  "colorMode" TEXT NOT NULL,
  "doubleSided" BOOLEAN NOT NULL DEFAULT true,
  "folded" TEXT,
  "finishing" TEXT,
  "quantity" INTEGER NOT NULL,
  "notes" TEXT,
  "estimatedDelivery" TIMESTAMP(3),
  "trackingNumber" TEXT,
  "estimatedNetPrice" DECIMAL(12,2),
  "estimatedGrossPrice" DECIMAL(12,2),
  "priceSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PrintOrder_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DocumentFolder"
  ADD CONSTRAINT "DocumentFolder_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Document"
  ADD CONSTRAINT "Document_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Document"
  ADD CONSTRAINT "Document_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Document"
  ADD CONSTRAINT "Document_folderId_fkey"
  FOREIGN KEY ("folderId") REFERENCES "DocumentFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Document"
  ADD CONSTRAINT "Document_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Document"
  ADD CONSTRAINT "Document_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DocumentVersion"
  ADD CONSTRAINT "DocumentVersion_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentVersion"
  ADD CONSTRAINT "DocumentVersion_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DocumentComment"
  ADD CONSTRAINT "DocumentComment_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentComment"
  ADD CONSTRAINT "DocumentComment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PrintOrder"
  ADD CONSTRAINT "PrintOrder_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrintOrder"
  ADD CONSTRAINT "PrintOrder_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrintOrder"
  ADD CONSTRAINT "PrintOrder_printerId_fkey"
  FOREIGN KEY ("printerId") REFERENCES "PrintPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PrintOrder"
  ADD CONSTRAINT "PrintOrder_warehouseInventoryId_fkey"
  FOREIGN KEY ("warehouseInventoryId") REFERENCES "WarehouseInventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "DocumentFolder_orderId_idx" ON "DocumentFolder"("orderId");
CREATE UNIQUE INDEX "DocumentFolder_orderId_name_key" ON "DocumentFolder"("orderId", "name");
CREATE INDEX "Document_customerId_status_idx" ON "Document"("customerId", "status");
CREATE INDEX "Document_orderId_documentType_idx" ON "Document"("orderId", "documentType");
CREATE INDEX "Document_folderId_idx" ON "Document"("folderId");
CREATE INDEX "Document_status_uploadedAt_idx" ON "Document"("status", "uploadedAt");
CREATE INDEX "Document_documentType_status_idx" ON "Document"("documentType", "status");
CREATE INDEX "Document_uploadedById_idx" ON "Document"("uploadedById");
CREATE INDEX "Document_approvedById_idx" ON "Document"("approvedById");
CREATE INDEX "Document_checksum_idx" ON "Document"("checksum");
CREATE UNIQUE INDEX "DocumentVersion_documentId_version_key" ON "DocumentVersion"("documentId", "version");
CREATE INDEX "DocumentVersion_documentId_createdAt_idx" ON "DocumentVersion"("documentId", "createdAt");
CREATE INDEX "DocumentVersion_uploadedById_createdAt_idx" ON "DocumentVersion"("uploadedById", "createdAt");
CREATE INDEX "DocumentVersion_checksum_idx" ON "DocumentVersion"("checksum");
CREATE INDEX "DocumentComment_documentId_createdAt_idx" ON "DocumentComment"("documentId", "createdAt");
CREATE INDEX "DocumentComment_userId_createdAt_idx" ON "DocumentComment"("userId", "createdAt");
CREATE INDEX "DocumentComment_visibility_idx" ON "DocumentComment"("visibility");
CREATE INDEX "PrintPartner_isActive_idx" ON "PrintPartner"("isActive");
CREATE INDEX "PrintPartner_companyName_idx" ON "PrintPartner"("companyName");
CREATE INDEX "PrintPartner_email_idx" ON "PrintPartner"("email");
CREATE INDEX "PrintOrder_orderId_status_idx" ON "PrintOrder"("orderId", "status");
CREATE INDEX "PrintOrder_customerId_status_idx" ON "PrintOrder"("customerId", "status");
CREATE INDEX "PrintOrder_printerId_status_idx" ON "PrintOrder"("printerId", "status");
CREATE INDEX "PrintOrder_warehouseInventoryId_idx" ON "PrintOrder"("warehouseInventoryId");
CREATE INDEX "PrintOrder_status_createdAt_idx" ON "PrintOrder"("status", "createdAt");
