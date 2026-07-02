-- Modul 11: Rechnungen nach Zahlung und Rechnungs-PDF
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'CREDITED';

CREATE TYPE "CreditNoteStatus" AS ENUM ('PREPARED', 'ISSUED', 'CANCELLED');

ALTER TABLE "Invoice"
  ADD COLUMN "paymentId" TEXT,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'EUR',
  ADD COLUMN "invoiceDate" TIMESTAMP(3),
  ADD COLUMN "serviceDate" TIMESTAMP(3),
  ADD COLUMN "dueDate" TIMESTAMP(3),
  ADD COLUMN "subtotalNet" DECIMAL(12,2),
  ADD COLUMN "vatRate" DECIMAL(5,4) NOT NULL DEFAULT 0.19,
  ADD COLUMN "totalGross" DECIMAL(12,2),
  ADD COLUMN "notes" TEXT;

UPDATE "Invoice"
SET
  "subtotalNet" = "amountNet",
  "totalGross" = "amountGross",
  "invoiceDate" = COALESCE("issuedAt", "createdAt"),
  "serviceDate" = COALESCE("issuedAt", "createdAt"),
  "dueDate" = COALESCE("issuedAt", "createdAt"),
  "paidAt" = COALESCE("paidAt", "issuedAt", "createdAt")
WHERE "subtotalNet" IS NULL OR "totalGross" IS NULL;

ALTER TABLE "Invoice"
  ALTER COLUMN "subtotalNet" SET NOT NULL,
  ALTER COLUMN "totalGross" SET NOT NULL;

CREATE TABLE "InvoiceItem" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "quantity" DECIMAL(12,2) NOT NULL,
  "unit" TEXT NOT NULL,
  "unitPriceNet" DECIMAL(12,2) NOT NULL,
  "vatRate" DECIMAL(5,4) NOT NULL,
  "lineTotalNet" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreditNote" (
  "id" TEXT NOT NULL,
  "creditNoteNumber" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "amountNet" DECIMAL(12,2) NOT NULL,
  "vatAmount" DECIMAL(12,2) NOT NULL,
  "totalGross" DECIMAL(12,2) NOT NULL,
  "status" "CreditNoteStatus" NOT NULL DEFAULT 'PREPARED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

INSERT INTO "InvoiceItem" (
  "id",
  "invoiceId",
  "title",
  "description",
  "quantity",
  "unit",
  "unitPriceNet",
  "vatRate",
  "lineTotalNet"
)
SELECT
  'legacy-item-' || "id",
  "id",
  'Flyerverteilung',
  'Automatisch migrierte Rechnungsposition',
  1,
  'Pauschal',
  "amountNet",
  0.19,
  "amountNet"
FROM "Invoice"
WHERE NOT EXISTS (
  SELECT 1 FROM "InvoiceItem" WHERE "InvoiceItem"."invoiceId" = "Invoice"."id"
);

CREATE UNIQUE INDEX "CreditNote_creditNoteNumber_key" ON "CreditNote"("creditNoteNumber");
CREATE INDEX "Invoice_paymentId_idx" ON "Invoice"("paymentId");
CREATE INDEX "Invoice_invoiceNumber_idx" ON "Invoice"("invoiceNumber");
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");
CREATE INDEX "CreditNote_invoiceId_status_idx" ON "CreditNote"("invoiceId", "status");

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
