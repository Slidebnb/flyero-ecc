ALTER TABLE "Warehouse" ADD COLUMN "isDemoData" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Warehouse_isDemoData_isActive_idx" ON "Warehouse"("isDemoData", "isActive");
