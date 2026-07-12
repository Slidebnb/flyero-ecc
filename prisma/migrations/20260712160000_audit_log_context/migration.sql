-- Add bounded request context to security-relevant audit entries.
ALTER TABLE "AuditLog" ADD COLUMN "requestId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "ipAddress" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "userAgent" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "result" TEXT NOT NULL DEFAULT 'SUCCESS';

CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");
