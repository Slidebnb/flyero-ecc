-- Additive checkout idempotency fields. Existing payments remain unchanged.
ALTER TABLE "Payment"
  ADD COLUMN "checkoutKey" TEXT,
  ADD COLUMN "checkoutClaimToken" TEXT,
  ADD COLUMN "checkoutClaimedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Payment_checkoutKey_key" ON "Payment"("checkoutKey");
CREATE UNIQUE INDEX "Payment_checkoutClaimToken_key" ON "Payment"("checkoutClaimToken");
