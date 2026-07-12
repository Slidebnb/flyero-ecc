CREATE TYPE "PaymentReconciliationRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "PaymentReconciliationResult" AS ENUM ('MATCH', 'MISMATCH', 'REMOTE_MISSING', 'ERROR');

CREATE TABLE "PaymentReconciliationRun" (
  "id" TEXT NOT NULL,
  "providerCode" TEXT NOT NULL,
  "status" "PaymentReconciliationRunStatus" NOT NULL DEFAULT 'RUNNING',
  "dryRun" BOOLEAN NOT NULL DEFAULT true,
  "checkedCount" INTEGER NOT NULL DEFAULT 0,
  "matchedCount" INTEGER NOT NULL DEFAULT 0,
  "mismatchCount" INTEGER NOT NULL DEFAULT 0,
  "missingCount" INTEGER NOT NULL DEFAULT 0,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentReconciliationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentReconciliationIssue" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "paymentId" TEXT,
  "result" "PaymentReconciliationResult" NOT NULL,
  "localStatus" "PaymentStatus",
  "remoteStatus" TEXT,
  "amountMismatch" BOOLEAN NOT NULL DEFAULT false,
  "currencyMismatch" BOOLEAN NOT NULL DEFAULT false,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentReconciliationIssue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentReconciliationRun_providerCode_status_startedAt_idx" ON "PaymentReconciliationRun"("providerCode", "status", "startedAt");
CREATE INDEX "PaymentReconciliationIssue_runId_result_idx" ON "PaymentReconciliationIssue"("runId", "result");
CREATE INDEX "PaymentReconciliationIssue_paymentId_createdAt_idx" ON "PaymentReconciliationIssue"("paymentId", "createdAt");

ALTER TABLE "PaymentReconciliationIssue"
  ADD CONSTRAINT "PaymentReconciliationIssue_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "PaymentReconciliationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentReconciliationIssue"
  ADD CONSTRAINT "PaymentReconciliationIssue_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
