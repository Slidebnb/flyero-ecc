-- Module 12: central company, branding, numbering and system settings.

ALTER TABLE "Warehouse"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "openingHours" TEXT,
ADD COLUMN "contactPerson" TEXT,
ADD COLUMN "contactPhone" TEXT,
ADD COLUMN "contactEmail" TEXT;

CREATE INDEX "Warehouse_isActive_isDefault_idx" ON "Warehouse"("isActive", "isDefault");

CREATE TABLE "CompanySettings" (
  "id" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "street" TEXT NOT NULL,
  "postalCode" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "country" TEXT NOT NULL DEFAULT 'DE',
  "phone" TEXT,
  "email" TEXT,
  "website" TEXT,
  "taxNumber" TEXT,
  "vatId" TEXT,
  "bankName" TEXT,
  "iban" TEXT,
  "bic" TEXT,
  "logoUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrandingSettings" (
  "id" TEXT NOT NULL,
  "primaryColor" TEXT NOT NULL DEFAULT '#102033',
  "secondaryColor" TEXT NOT NULL DEFAULT '#176b36',
  "accentColor" TEXT NOT NULL DEFAULT '#e0b84d',
  "logoUrl" TEXT,
  "reportFooterText" TEXT,
  "invoiceFooterText" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BrandingSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NumberingSettings" (
  "id" TEXT NOT NULL,
  "invoicePrefix" TEXT NOT NULL DEFAULT 'FLY-RE',
  "invoiceYear" INTEGER NOT NULL,
  "invoiceNextNumber" INTEGER NOT NULL DEFAULT 1,
  "reportPrefix" TEXT NOT NULL DEFAULT 'RPT',
  "reportYear" INTEGER NOT NULL,
  "reportNextNumber" INTEGER NOT NULL DEFAULT 1,
  "orderPrefix" TEXT NOT NULL DEFAULT 'ORD',
  "orderYear" INTEGER NOT NULL,
  "orderNextNumber" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NumberingSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SystemSettings" (
  "id" TEXT NOT NULL,
  "defaultVatRate" DECIMAL(5,4) NOT NULL DEFAULT 0.19,
  "defaultCurrency" TEXT NOT NULL DEFAULT 'EUR',
  "paymentDueDays" INTEGER NOT NULL DEFAULT 14,
  "allowManualInvoiceCreation" BOOLEAN NOT NULL DEFAULT true,
  "requirePaymentBeforeReview" BOOLEAN NOT NULL DEFAULT true,
  "requireAdminReviewAfterPayment" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);
