-- Module 24: order experience analytics and UX telemetry.

CREATE TABLE "OrderExperienceEvent" (
  "id" TEXT NOT NULL,
  "orderId" TEXT,
  "customerId" TEXT,
  "userId" TEXT,
  "eventType" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'order-wizard',
  "city" TEXT,
  "postalCode" TEXT,
  "areaName" TEXT,
  "areaType" "DistributionAreaType",
  "durationMs" INTEGER,
  "clickCount" INTEGER,
  "fieldCount" INTEGER,
  "usedAutocomplete" BOOLEAN NOT NULL DEFAULT false,
  "usedSavedArea" BOOLEAN NOT NULL DEFAULT false,
  "polygonPoints" INTEGER,
  "households" INTEGER,
  "flyerQuantity" INTEGER,
  "coverageAreaSqm" DECIMAL(14,2),
  "routeDistanceMeters" INTEGER,
  "routeDurationMinutes" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrderExperienceEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderExperienceEvent_eventType_createdAt_idx" ON "OrderExperienceEvent"("eventType", "createdAt");
CREATE INDEX "OrderExperienceEvent_customerId_createdAt_idx" ON "OrderExperienceEvent"("customerId", "createdAt");
CREATE INDEX "OrderExperienceEvent_city_createdAt_idx" ON "OrderExperienceEvent"("city", "createdAt");
CREATE INDEX "OrderExperienceEvent_postalCode_createdAt_idx" ON "OrderExperienceEvent"("postalCode", "createdAt");
CREATE INDEX "OrderExperienceEvent_orderId_idx" ON "OrderExperienceEvent"("orderId");

ALTER TABLE "OrderExperienceEvent"
  ADD CONSTRAINT "OrderExperienceEvent_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderExperienceEvent"
  ADD CONSTRAINT "OrderExperienceEvent_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderExperienceEvent"
  ADD CONSTRAINT "OrderExperienceEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
