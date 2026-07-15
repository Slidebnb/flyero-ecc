ALTER TABLE "Lead"
  ADD COLUMN "inquiryNumber" TEXT,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "inquiryData" JSONB;

CREATE UNIQUE INDEX "Lead_inquiryNumber_key" ON "Lead"("inquiryNumber");
CREATE UNIQUE INDEX "Lead_idempotencyKey_key" ON "Lead"("idempotencyKey");
