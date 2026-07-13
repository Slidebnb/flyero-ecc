CREATE TABLE "RetentionHold" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "caseReference" TEXT,
    "releaseNote" TEXT,
    "createdById" TEXT NOT NULL,
    "releasedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "RetentionHold_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RetentionHold_tenantId_releasedAt_expiresAt_idx" ON "RetentionHold"("tenantId", "releasedAt", "expiresAt");
CREATE INDEX "RetentionHold_orderId_releasedAt_expiresAt_idx" ON "RetentionHold"("orderId", "releasedAt", "expiresAt");
CREATE INDEX "RetentionHold_createdById_createdAt_idx" ON "RetentionHold"("createdById", "createdAt");

ALTER TABLE "RetentionHold" ADD CONSTRAINT "RetentionHold_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RetentionHold" ADD CONSTRAINT "RetentionHold_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetentionHold" ADD CONSTRAINT "RetentionHold_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RetentionHold" ADD CONSTRAINT "RetentionHold_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
