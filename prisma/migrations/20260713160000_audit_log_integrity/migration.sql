-- Add a local tamper-evidence chain to audit entries.
ALTER TABLE "AuditLog" ADD COLUMN "previousIntegrityHash" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "integrityHash" TEXT;

CREATE INDEX "AuditLog_integrityHash_idx" ON "AuditLog"("integrityHash");
