CREATE TABLE "PublicRateLimitBucket" (
  "id" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "windowStartedAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "blockedUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PublicRateLimitBucket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PublicRateLimitBucket_scope_updatedAt_idx" ON "PublicRateLimitBucket"("scope", "updatedAt");
CREATE INDEX "PublicRateLimitBucket_blockedUntil_idx" ON "PublicRateLimitBucket"("blockedUntil");
