import { access } from "node:fs/promises";
import path from "node:path";
import {
  BackgroundJobStatus,
  ErrorSeverity,
  ErrorStatus,
  HealthStatus,
  Prisma,
  SystemLogLevel,
} from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { privateStorageConfiguration } from "@/lib/privateObjectStorage";
import { prisma } from "@/lib/prisma";

type JsonMetadata = Prisma.InputJsonValue | undefined;

type ErrorLogInput = {
  severity?: ErrorSeverity;
  source: string;
  message: string;
  stack?: string | null;
  metadata?: JsonMetadata;
};

function statusFromChecks(checks: HealthStatus[]) {
  if (checks.includes(HealthStatus.DOWN)) return HealthStatus.DOWN;
  if (checks.includes(HealthStatus.DEGRADED)) return HealthStatus.DEGRADED;
  return HealthStatus.OK;
}

function normalizeError(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) {
    return {
      message: error.message || fallbackMessage,
      stack: error.stack,
    };
  }

  return {
    message: typeof error === "string" ? error : fallbackMessage,
    stack: undefined,
  };
}

async function notifyMonitoringAdmins(type: string, title: string, message: string, data?: Record<string, string | number>) {
  try {
    const { notifyAdmins } = await import("@/lib/notifications");
    await notifyAdmins({ type, title, message, data });
  } catch {
    // Monitoring darf den eigentlichen Prozess nicht blockieren, wenn Notifications selbst gestört sind.
  }
}

export async function createSystemLog(input: {
  level?: SystemLogLevel;
  source: string;
  message: string;
  metadata?: JsonMetadata;
}) {
  return prisma.systemLog.create({
    data: {
      level: input.level ?? SystemLogLevel.INFO,
      source: input.source,
      message: input.message,
      metadata: input.metadata,
    },
  });
}

export async function createErrorLog(input: ErrorLogInput) {
  const error = await prisma.errorLog.create({
    data: {
      severity: input.severity ?? ErrorSeverity.MEDIUM,
      source: input.source,
      message: input.message,
      stack: input.stack,
      metadata: input.metadata,
    },
  });

  await createSystemLog({
    level: input.severity === ErrorSeverity.CRITICAL ? SystemLogLevel.CRITICAL : SystemLogLevel.ERROR,
    source: input.source,
    message: input.message,
    metadata: { errorLogId: error.id },
  });

  await createAuditLog({
    action: "monitoring.error_created",
    entityType: "ErrorLog",
    entityId: error.id,
    newValues: { severity: error.severity, status: error.status, source: error.source },
  });

  if (error.severity === ErrorSeverity.CRITICAL) {
    await notifyMonitoringAdmins(
      "MONITORING_CRITICAL_ERROR",
      "Kritischer Fehler erkannt",
      `${error.source}: ${error.message}`,
      { errorLogId: error.id, source: error.source },
    );
  }

  return error;
}

export async function createErrorLogFromUnknown(
  error: unknown,
  input: Omit<ErrorLogInput, "message" | "stack"> & { fallbackMessage: string },
) {
  const normalized = normalizeError(error, input.fallbackMessage);
  return createErrorLog({
    severity: input.severity,
    source: input.source,
    message: normalized.message,
    stack: normalized.stack,
    metadata: input.metadata,
  });
}

export async function resolveErrorLog(id: string, userId: string, resolutionNote?: string) {
  const error = await prisma.errorLog.update({
    where: { id },
    data: {
      status: ErrorStatus.RESOLVED,
      resolvedById: userId,
      resolvedAt: new Date(),
      resolutionNote: resolutionNote || null,
    },
  });

  await createAuditLog({
    userId,
    action: "monitoring.error_resolved",
    entityType: "ErrorLog",
    entityId: error.id,
    newValues: { status: error.status, resolutionNote: error.resolutionNote },
  });

  await notifyMonitoringAdmins(
    "MONITORING_ERROR_RESOLVED",
    "Fehler gelöst",
    `${error.source}: ${error.message}`,
    { errorLogId: error.id, source: error.source },
  );

  return error;
}

export async function markErrorLogInProgress(id: string, userId: string, resolutionNote?: string) {
  const error = await prisma.errorLog.update({
    where: { id },
    data: {
      status: ErrorStatus.IN_PROGRESS,
      resolvedById: userId,
      resolutionNote: resolutionNote || null,
    },
  });

  await createAuditLog({
    userId,
    action: "monitoring.error_in_progress",
    entityType: "ErrorLog",
    entityId: error.id,
    newValues: { status: error.status, resolutionNote: error.resolutionNote },
  });

  return error;
}

export async function ignoreErrorLog(id: string, userId: string, resolutionNote?: string) {
  const error = await prisma.errorLog.update({
    where: { id },
    data: {
      status: ErrorStatus.IGNORED,
      resolvedById: userId,
      resolvedAt: new Date(),
      resolutionNote: resolutionNote || null,
    },
  });

  await createAuditLog({
    userId,
    action: "monitoring.error_ignored",
    entityType: "ErrorLog",
    entityId: error.id,
    newValues: { status: error.status, resolutionNote: error.resolutionNote },
  });

  return error;
}

export async function runHealthCheck(userId?: string) {
  let databaseStatus: HealthStatus = HealthStatus.OK;
  let databaseError: string | null = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    databaseStatus = HealthStatus.DOWN;
    databaseError = normalizeError(error, "Datenbank nicht erreichbar.").message;
  }

  let storageStatus: HealthStatus = HealthStatus.OK;
  let storageError: string | null = null;
  let storageProvider = "local";
  let storageConfigured = true;
  try {
    const configuration = privateStorageConfiguration();
    storageProvider = configuration.provider;
    storageConfigured = configuration.configured;
    if (!configuration.configured) {
      storageStatus = HealthStatus.DOWN;
      storageError = "Privater Object-Storage ist unvollständig konfiguriert.";
    } else if (configuration.provider === "local") {
      await access(path.join(process.cwd(), "public"));
    }
  } catch (error) {
    storageStatus = HealthStatus.DOWN;
    storageError = normalizeError(error, "Storage-Pfad nicht erreichbar.").message;
  }

  const stripeStatus = process.env.STRIPE_SECRET_KEY ? HealthStatus.OK : HealthStatus.DEGRADED;
  const googleMapsBrowserConfigured = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY);
  const googleMapsServerConfigured = Boolean(process.env.GOOGLE_MAPS_SERVER_KEY);
  const googleMapsStatus = googleMapsBrowserConfigured && googleMapsServerConfigured ? HealthStatus.OK : HealthStatus.DEGRADED;
  const emailStatus = process.env.SMTP_HOST || process.env.EMAIL_PROVIDER ? HealthStatus.OK : HealthStatus.DEGRADED;
  const failedQueueCount = await prisma.notificationQueue.count({ where: { status: { in: ["FAILED", "RETRY"] } } }).catch(() => 0);
  const queueStatus = failedQueueCount > 20 ? HealthStatus.DEGRADED : HealthStatus.OK;

  const status = statusFromChecks([
    databaseStatus,
    storageStatus,
    stripeStatus,
    googleMapsStatus,
    emailStatus,
    queueStatus,
  ]);

  const healthCheck = await prisma.systemHealthCheck.create({
    data: {
      status,
      databaseStatus,
      storageStatus,
      stripeStatus,
      googleMapsStatus,
      emailStatus,
      queueStatus,
      metadata: {
        databaseError,
        storageError,
        storageProvider,
        storageConfigured,
        failedQueueCount,
        stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
        googleMapsConfigured: googleMapsBrowserConfigured && googleMapsServerConfigured,
        googleMapsBrowserConfigured,
        googleMapsServerConfigured,
        emailConfigured: Boolean(process.env.SMTP_HOST || process.env.EMAIL_PROVIDER),
      },
    },
  });

  await createSystemLog({
    level: status === HealthStatus.OK ? SystemLogLevel.INFO : status === HealthStatus.DEGRADED ? SystemLogLevel.WARNING : SystemLogLevel.CRITICAL,
    source: "system.health",
    message: `Health Check: ${status}`,
    metadata: { healthCheckId: healthCheck.id },
  });

  await createAuditLog({
    userId,
    action: "monitoring.health_checked",
    entityType: "SystemHealthCheck",
    entityId: healthCheck.id,
    newValues: { status },
  });

  if (status === HealthStatus.DEGRADED || status === HealthStatus.DOWN) {
    await notifyMonitoringAdmins(
      status === HealthStatus.DOWN ? "MONITORING_HEALTH_DOWN" : "MONITORING_HEALTH_DEGRADED",
      status === HealthStatus.DOWN ? "Health Status DOWN" : "Health Status DEGRADED",
      `Systemstatus: ${status}`,
      { healthCheckId: healthCheck.id },
    );
  }

  return healthCheck;
}

export async function getMonitoringDashboard() {
  const [
    latestHealth,
    recentHealthChecks,
    criticalOpenErrors,
    errorsBySource,
    failedJobs,
    queueCounts,
    openErrors,
    recentSystemLogs,
  ] = await Promise.all([
    prisma.systemHealthCheck.findFirst({ orderBy: { checkedAt: "desc" } }),
    prisma.systemHealthCheck.findMany({ orderBy: { checkedAt: "desc" }, take: 10 }),
    prisma.errorLog.findMany({
      where: { severity: ErrorSeverity.CRITICAL, status: { in: [ErrorStatus.OPEN, ErrorStatus.IN_PROGRESS] } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.errorLog.groupBy({
      by: ["source"],
      _count: { source: true },
      where: { status: { in: [ErrorStatus.OPEN, ErrorStatus.IN_PROGRESS] } },
      orderBy: { _count: { source: "desc" } },
      take: 12,
    }),
    prisma.backgroundJobLog.findMany({ where: { status: BackgroundJobStatus.FAILED }, orderBy: { startedAt: "desc" }, take: 10 }),
    prisma.notificationQueue.groupBy({ by: ["status"], _count: { status: true } }),
    prisma.errorLog.count({ where: { status: { in: [ErrorStatus.OPEN, ErrorStatus.IN_PROGRESS] } } }),
    prisma.systemLog.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
  ]);

  return {
    latestHealth,
    recentHealthChecks,
    criticalOpenErrors,
    errorsBySource,
    failedJobs,
    queueCounts,
    openErrors,
    recentSystemLogs,
  };
}

export async function logBackgroundJobStart(jobType: string, metadata?: JsonMetadata) {
  return prisma.backgroundJobLog.create({
    data: {
      jobType,
      status: BackgroundJobStatus.STARTED,
      metadata,
    },
  });
}

export async function logBackgroundJobSuccess(id: string, metadata?: JsonMetadata) {
  const existing = await prisma.backgroundJobLog.findUnique({ where: { id } });
  const finishedAt = new Date();
  return prisma.backgroundJobLog.update({
    where: { id },
    data: {
      status: BackgroundJobStatus.SUCCESS,
      finishedAt,
      durationMs: existing ? finishedAt.getTime() - existing.startedAt.getTime() : null,
      metadata: metadata ?? existing?.metadata ?? undefined,
    },
  });
}

export async function logBackgroundJobFailure(id: string, error: unknown, metadata?: JsonMetadata) {
  const existing = await prisma.backgroundJobLog.findUnique({ where: { id } });
  const finishedAt = new Date();
  const normalized = normalizeError(error, "Background Job fehlgeschlagen.");
  const job = await prisma.backgroundJobLog.update({
    where: { id },
    data: {
      status: BackgroundJobStatus.FAILED,
      finishedAt,
      durationMs: existing ? finishedAt.getTime() - existing.startedAt.getTime() : null,
      errorMessage: normalized.message,
      metadata: metadata ?? existing?.metadata ?? undefined,
    },
  });

  await createAuditLog({
    action: "monitoring.job_failed",
    entityType: "BackgroundJobLog",
    entityId: job.id,
    newValues: { jobType: job.jobType, errorMessage: job.errorMessage },
  });

  await createErrorLog({
    severity: ErrorSeverity.HIGH,
    source: `background.${job.jobType}`,
    message: normalized.message,
    stack: normalized.stack,
    metadata: { jobLogId: job.id },
  });

  return job;
}
