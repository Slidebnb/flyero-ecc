-- Modul 16: Landingpage-Leads und Lead-Statusverwaltung
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST');

CREATE TYPE "LeadType" AS ENUM ('CUSTOMER', 'DISTRIBUTOR', 'PARTNER', 'OTHER');

CREATE TABLE "Lead" (
  "id" TEXT NOT NULL,
  "type" "LeadType" NOT NULL,
  "name" TEXT NOT NULL,
  "companyName" TEXT,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "city" TEXT,
  "message" TEXT NOT NULL,
  "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
  "source" TEXT NOT NULL DEFAULT 'website',
  "adminNote" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Lead_type_status_idx" ON "Lead"("type", "status");
CREATE INDEX "Lead_status_createdAt_idx" ON "Lead"("status", "createdAt");
CREATE INDEX "Lead_archivedAt_idx" ON "Lead"("archivedAt");
CREATE INDEX "Lead_email_idx" ON "Lead"("email");
