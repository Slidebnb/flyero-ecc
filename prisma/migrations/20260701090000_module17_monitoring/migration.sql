-- CreateEnum
CREATE TYPE "SystemLogLevel" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ErrorSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ErrorStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'IGNORED');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('OK', 'DEGRADED', 'DOWN');

-- CreateEnum
CREATE TYPE "BackgroundJobStatus" AS ENUM ('STARTED', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" TEXT NOT NULL,
    "level" "SystemLogLevel" NOT NULL,
    "source" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErrorLog" (
    "id" TEXT NOT NULL,
    "severity" "ErrorSeverity" NOT NULL,
    "source" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "metadata" JSONB,
    "status" "ErrorStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemHealthCheck" (
    "id" TEXT NOT NULL,
    "status" "HealthStatus" NOT NULL,
    "databaseStatus" "HealthStatus" NOT NULL,
    "storageStatus" "HealthStatus" NOT NULL,
    "stripeStatus" "HealthStatus" NOT NULL,
    "googleMapsStatus" "HealthStatus" NOT NULL,
    "emailStatus" "HealthStatus" NOT NULL,
    "queueStatus" "HealthStatus" NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "SystemHealthCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackgroundJobLog" (
    "id" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "status" "BackgroundJobStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "metadata" JSONB,

    CONSTRAINT "BackgroundJobLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemLog_level_createdAt_idx" ON "SystemLog"("level", "createdAt");

-- CreateIndex
CREATE INDEX "SystemLog_source_createdAt_idx" ON "SystemLog"("source", "createdAt");

-- CreateIndex
CREATE INDEX "ErrorLog_severity_status_createdAt_idx" ON "ErrorLog"("severity", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ErrorLog_source_createdAt_idx" ON "ErrorLog"("source", "createdAt");

-- CreateIndex
CREATE INDEX "ErrorLog_resolvedById_resolvedAt_idx" ON "ErrorLog"("resolvedById", "resolvedAt");

-- CreateIndex
CREATE INDEX "SystemHealthCheck_status_checkedAt_idx" ON "SystemHealthCheck"("status", "checkedAt");

-- CreateIndex
CREATE INDEX "SystemHealthCheck_checkedAt_idx" ON "SystemHealthCheck"("checkedAt");

-- CreateIndex
CREATE INDEX "BackgroundJobLog_jobType_status_startedAt_idx" ON "BackgroundJobLog"("jobType", "status", "startedAt");

-- CreateIndex
CREATE INDEX "BackgroundJobLog_status_startedAt_idx" ON "BackgroundJobLog"("status", "startedAt");

-- AddForeignKey
ALTER TABLE "ErrorLog" ADD CONSTRAINT "ErrorLog_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
