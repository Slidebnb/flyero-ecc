import { randomUUID } from "node:crypto";
import { UserRole, type DocumentType, type ReportSource } from "@prisma/client";
import { z } from "zod";
import { requireRole, type SessionUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { normalizeExtension, storeDocumentFile, protectedDocumentUrl, type UploadableDocumentFile } from "@/lib/documentStorage";
import { notifyAdmins } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { generateOnlineReportUrl, generateReportNumber, publishReport } from "@/lib/reports";

const evidenceTypeSchema = z.enum(["GPS_PDF", "GPS_FILE", "PHOTO", "OTHER"]);
const optionalDateFromForm = z.preprocess((value) => (value === "" || value === null ? undefined : value), z.coerce.date().optional());
const optionalIntegerFromForm = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().int().min(0).optional(),
);
const allowedEvidenceExtensions: Record<z.infer<typeof evidenceTypeSchema>, string[]> = {
  GPS_PDF: ["pdf"],
  GPS_FILE: ["gpx", "kml", "kmz"],
  PHOTO: ["jpg", "jpeg", "png", "webp"],
  OTHER: ["pdf", "jpg", "jpeg", "png", "webp", "gpx", "kml", "kmz"],
};

export const externalEvidenceUploadSchema = z.object({
  evidenceType: evidenceTypeSchema.default("GPS_PDF"),
  title: z.string().trim().min(2).max(180).optional(),
  providerName: z.string().trim().max(160).optional(),
  externalReportReference: z.string().trim().max(160).optional(),
  reportDate: optionalDateFromForm,
});

export const externalReportPrepareSchema = z.object({
  distributionDate: optionalDateFromForm,
  startTime: optionalDateFromForm,
  endTime: optionalDateFromForm,
  deliveredFlyerQuantity: optionalIntegerFromForm,
  remainingFlyerQuantity: optionalIntegerFromForm,
  distributorId: z.string().trim().optional(),
  distributorName: z.string().trim().max(180).optional(),
  summary: z.string().trim().max(3000).optional(),
  deviationSummary: z.string().trim().max(3000).optional(),
  internalNote: z.string().trim().max(3000).optional(),
  customerNote: z.string().trim().max(3000).optional(),
});

function documentTypeForEvidence(type: z.infer<typeof evidenceTypeSchema>): DocumentType {
  if (type === "PHOTO") return "IMAGE";
  return "REPORT";
}

function reportSourceForEvidence(type: z.infer<typeof evidenceTypeSchema>): ReportSource {
  if (type === "GPS_PDF" || type === "GPS_FILE") return "EXTERNAL_GPS_REPORT";
  return "MANUAL_EVIDENCE";
}

function assertEvidenceFileMatchesType(type: z.infer<typeof evidenceTypeSchema>, file: UploadableDocumentFile) {
  const extension = normalizeExtension(file.originalFilename);
  const allowed = allowedEvidenceExtensions[type];
  if (!allowed.includes(extension)) {
    throw new Error(`Dieser Nachweistyp erlaubt nur: ${allowed.map((item) => `.${item}`).join(", ")}.`);
  }
}

export async function uploadExternalEvidence(input: {
  actor: SessionUser;
  orderId: string;
  payload: unknown;
  file: UploadableDocumentFile;
}) {
  const data = externalEvidenceUploadSchema.parse(input.payload);
  assertEvidenceFileMatchesType(data.evidenceType, input.file);
  const order = await prisma.order.findUnique({ where: { id: input.orderId }, select: { id: true, customerId: true, tenantId: true, orderNumber: true } });
  if (!order) throw new Error("Auftrag wurde nicht gefunden.");

  const stored = await storeDocumentFile(input.file);
  const document = await prisma.document.create({
    data: {
      orderId: order.id,
      customerId: order.customerId,
      tenantId: order.tenantId,
      documentType: documentTypeForEvidence(data.evidenceType),
      title: data.title || (data.evidenceType === "GPS_PDF" ? "GPS-Nachweis des eingesetzten Trackingsystems" : input.file.originalFilename),
      originalFilename: input.file.originalFilename,
      storedFilename: stored.storageKey,
      mimeType: stored.mimeType,
      extension: stored.extension,
      fileSize: stored.fileSize,
      checksum: stored.checksum,
      status: "UNDER_REVIEW",
      providerName: data.providerName || null,
      externalReportReference: data.externalReportReference || null,
      reportDate: data.reportDate ?? null,
      customerVisible: false,
      reviewStatus: "PENDING",
      uploadedById: input.actor.id,
      versions: {
        create: {
          version: 1,
          storageKey: stored.storageKey,
          fileUrl: "pending",
          checksum: stored.checksum,
          uploadedById: input.actor.id,
        },
      },
    },
  });
  await prisma.documentVersion.updateMany({
    where: { documentId: document.id, version: 1 },
    data: { fileUrl: protectedDocumentUrl(document.id, 1) },
  });
  await createAuditLog({
    userId: input.actor.id,
    action: "external_evidence.uploaded",
    entityType: "Document",
    entityId: document.id,
    newValues: { evidenceType: data.evidenceType, providerName: data.providerName, reportSource: reportSourceForEvidence(data.evidenceType) },
  });
  return document;
}

async function ensureManualEvidenceTour(input: {
  orderId: string;
  distributorId?: string;
  startTime?: Date;
  endTime?: Date;
  deliveredFlyerQuantity?: number;
  remainingFlyerQuantity?: number;
}) {
  const order = await prisma.order.findUnique({ where: { id: input.orderId }, select: { id: true, flyerQuantity: true, assignedDistributorId: true } });
  if (!order) throw new Error("Auftrag wurde nicht gefunden.");
  const existing = await prisma.distributionTour.findFirst({ where: { orderId: input.orderId }, orderBy: { updatedAt: "desc" } });
  if (existing) {
    return updateManualEvidenceTour({
      tourId: existing.id,
      distributorId: input.distributorId,
      plannedFlyerQuantity: existing.plannedFlyerQuantity ?? order.flyerQuantity,
      startTime: input.startTime,
      endTime: input.endTime,
      deliveredFlyerQuantity: input.deliveredFlyerQuantity,
      remainingFlyerQuantity: input.remainingFlyerQuantity,
    });
  }
  const distributor = input.distributorId
    ? await prisma.distributorProfile.findFirst({ where: { id: input.distributorId, reviewStatus: "APPROVED" } })
    : order.assignedDistributorId
    ? await prisma.distributorProfile.findUnique({ where: { id: order.assignedDistributorId } })
    : await prisma.distributorProfile.findFirst({ where: { reviewStatus: "APPROVED" }, orderBy: { createdAt: "asc" } });
  if (!distributor) throw new Error("Bitte zuerst einen Verteilerkontakt oder Verteiler zuweisen.");
  return prisma.distributionTour.create({
    data: {
      orderId: order.id,
      distributorId: distributor.id,
      status: "APPROVED",
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      startedAt: input.startTime ?? null,
      completedAt: input.endTime ?? null,
      plannedFlyerQuantity: order.flyerQuantity,
      deliveredFlyerQuantity: input.deliveredFlyerQuantity ?? null,
      remainingFlyers: input.remainingFlyerQuantity ?? null,
      adminReviewStatus: "APPROVED",
    },
  });
}

async function updateManualEvidenceTour(input: {
  tourId: string;
  distributorId?: string;
  plannedFlyerQuantity: number;
  startTime?: Date;
  endTime?: Date;
  deliveredFlyerQuantity?: number;
  remainingFlyerQuantity?: number;
}) {
  const data = {
    ...(input.distributorId ? { distributorId: input.distributorId } : {}),
    status: "APPROVED" as const,
    adminReviewStatus: "APPROVED" as const,
    plannedFlyerQuantity: input.plannedFlyerQuantity,
    ...(input.startTime ? { startTime: input.startTime, startedAt: input.startTime } : {}),
    ...(input.endTime ? { endTime: input.endTime, completedAt: input.endTime } : {}),
    ...(input.deliveredFlyerQuantity !== undefined ? { deliveredFlyerQuantity: input.deliveredFlyerQuantity } : {}),
    ...(input.remainingFlyerQuantity !== undefined ? { remainingFlyers: input.remainingFlyerQuantity } : {}),
  };
  return prisma.distributionTour.update({
    where: { id: input.tourId },
    data,
  });
}

export async function prepareExternalReportForOrder(input: {
  actor: SessionUser;
  orderId: string;
  payload: unknown;
}) {
  const data = externalReportPrepareSchema.parse(input.payload);
  const order = await prisma.order.findUnique({ where: { id: input.orderId }, include: { customer: true } });
  if (!order) throw new Error("Auftrag wurde nicht gefunden.");
  const evidenceDocuments = await prisma.document.findMany({
    where: { orderId: order.id, documentType: { in: ["REPORT", "IMAGE"] } },
    orderBy: { uploadedAt: "desc" },
  });
  const gpsDocument = evidenceDocuments.find((document) => document.documentType === "REPORT" && (document.providerName || document.extension === "pdf"))
    ?? evidenceDocuments.find((document) => document.documentType === "REPORT");
  if (!gpsDocument) throw new Error("Bitte zuerst einen externen GPS-Bericht hochladen.");

  const tour = await ensureManualEvidenceTour({
    orderId: order.id,
    distributorId: data.distributorId,
    startTime: data.startTime,
    endTime: data.endTime,
    deliveredFlyerQuantity: data.deliveredFlyerQuantity,
    remainingFlyerQuantity: data.remainingFlyerQuantity,
  });
  const now = new Date();
  const manualDistributor = data.distributorName
    ? await prisma.manualDistributor.create({
        data: {
          name: data.distributorName,
          region: order.city,
          notes: `Manuell im Verteilnachweis für ${order.orderNumber} erfasst.`,
        },
      })
    : null;
  const actualStartedAt = data.startTime ?? data.distributionDate ?? null;
  const actualCompletedAt = data.endTime ?? null;
  const delivered = data.deliveredFlyerQuantity ?? order.flyerQuantity;
  const remaining = data.remainingFlyerQuantity ?? Math.max(order.flyerQuantity - delivered, 0);
  const summary = data.summary || "Nachweis basiert auf externem GPS-Bericht und manueller Prüfung.";
  const reportSnapshot = {
    source: "EXTERNAL_GPS_REPORT",
    generatedAt: now.toISOString(),
    distributionDate: data.distributionDate?.toISOString() ?? null,
    evidenceDocumentIds: evidenceDocuments.map((document) => document.id),
    photoDocumentIds: evidenceDocuments.filter((document) => document.documentType === "IMAGE").map((document) => document.id),
    gpsDocumentId: gpsDocument.id,
    externalProvider: gpsDocument.providerName,
    externalReportReference: gpsDocument.externalReportReference,
    manualDistributorId: manualDistributor?.id ?? null,
    selectedDistributorId: data.distributorId || null,
    manualDistributorName: data.distributorName || null,
    plannedFlyerQuantity: order.flyerQuantity,
    deliveredFlyerQuantity: delivered,
    remainingFlyerQuantity: remaining,
    summary,
    customerNote: data.customerNote || null,
    internalNote: data.internalNote || null,
    coverageStatement: "Keine automatische Coverage-Berechnung ohne interne Rohdaten.",
  };
  const report = await prisma.report.upsert({
    where: { tourId: tour.id },
    update: {
      status: "READY_FOR_REVIEW",
      reportSource: "EXTERNAL_GPS_REPORT",
      internalReviewStatus: "IN_REVIEW",
      generatedAt: now,
      reviewedById: input.actor.id,
      reviewedAt: now,
      plannedFlyerQuantity: order.flyerQuantity,
      deliveredFlyerQuantity: delivered,
      remainingFlyerQuantity: remaining,
      actualCoveragePercent: null,
      flyerCoveragePercent: null,
      areaCoveragePercent: null,
      householdCoverageEstimate: null,
      estimatedReachedHouseholds: null,
      actualStartedAt,
      actualCompletedAt,
      summary,
      deviationSummary: data.deviationSummary || null,
      reportSnapshot,
      calculationVersion: "external-evidence-mvp-v1",
      coverageMode: "external_gps_manual_review",
    },
    create: {
      orderId: order.id,
      tourId: tour.id,
      customerId: order.customerId,
      tenantId: order.tenantId,
      reportNumber: await generateReportNumber(),
      status: "READY_FOR_REVIEW",
      reportType: "DISTRIBUTION_PROOF",
      template: "STANDARD",
      reportSource: "EXTERNAL_GPS_REPORT",
      onlineUrl: "",
      generatedAt: now,
      reviewedById: input.actor.id,
      reviewedAt: now,
      internalReviewStatus: "IN_REVIEW",
      plannedFlyerQuantity: order.flyerQuantity,
      deliveredFlyerQuantity: delivered,
      remainingFlyerQuantity: remaining,
      actualCoveragePercent: null,
      flyerCoveragePercent: null,
      areaCoveragePercent: null,
      householdCoverageEstimate: null,
      estimatedReachedHouseholds: null,
      actualStartedAt,
      actualCompletedAt,
      summary,
      deviationSummary: data.deviationSummary || null,
      reportSnapshot,
      calculationVersion: "external-evidence-mvp-v1",
      coverageMode: "external_gps_manual_review",
      verificationCode: `VRF-${randomUUID().slice(0, 12).toUpperCase()}`,
    },
  });
  await prisma.report.update({ where: { id: report.id }, data: { onlineUrl: generateOnlineReportUrl(report.id) } });
  await createAuditLog({
    userId: input.actor.id,
    action: "external_report.prepared",
    entityType: "Report",
    entityId: report.id,
    newValues: { orderId: order.id, gpsDocumentId: gpsDocument.id, source: "EXTERNAL_GPS_REPORT" },
  });
  await notifyAdmins({
    type: "EXTERNAL_REPORT_READY_FOR_REVIEW",
    title: "Externer Verteilnachweis vorbereitet",
    message: `${order.orderNumber}: GPS-Nachweis wurde für die Prüfung vorbereitet.`,
  });
  return report;
}

export async function publishExternalReport(input: { actor: SessionUser; reportId: string }) {
  return publishReport({ reportId: input.reportId, adminUserId: input.actor.id });
}

export async function requireAdminEvidenceSession() {
  return requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
}
