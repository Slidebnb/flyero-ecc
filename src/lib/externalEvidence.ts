import { randomUUID } from "node:crypto";
import { UserRole, type DocumentType, type ReportSource } from "@prisma/client";
import { z } from "zod";
import { requireRole, type SessionUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { storeDocumentFile, protectedDocumentUrl, type UploadableDocumentFile } from "@/lib/documentStorage";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { generateOnlineReportUrl, generateReportNumber } from "@/lib/reports";

const evidenceTypeSchema = z.enum(["GPS_PDF", "GPS_FILE", "PHOTO", "OTHER"]);

export const externalEvidenceUploadSchema = z.object({
  evidenceType: evidenceTypeSchema.default("GPS_PDF"),
  title: z.string().trim().min(2).max(180).optional(),
  providerName: z.string().trim().max(160).optional(),
  externalReportReference: z.string().trim().max(160).optional(),
  reportDate: z.coerce.date().optional(),
  customerVisible: z.coerce.boolean().default(false),
});

export const externalReportPrepareSchema = z.object({
  distributionDate: z.coerce.date().optional(),
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
  deliveredFlyerQuantity: z.coerce.number().int().min(0).optional(),
  remainingFlyerQuantity: z.coerce.number().int().min(0).optional(),
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

export async function uploadExternalEvidence(input: {
  actor: SessionUser;
  orderId: string;
  payload: unknown;
  file: UploadableDocumentFile;
}) {
  const data = externalEvidenceUploadSchema.parse(input.payload);
  const order = await prisma.order.findUnique({ where: { id: input.orderId }, select: { id: true, customerId: true, orderNumber: true } });
  if (!order) throw new Error("Auftrag wurde nicht gefunden.");

  const stored = await storeDocumentFile(input.file);
  const document = await prisma.document.create({
    data: {
      orderId: order.id,
      customerId: order.customerId,
      documentType: documentTypeForEvidence(data.evidenceType),
      title: data.title || (data.evidenceType === "GPS_PDF" ? "GPS-Nachweis des eingesetzten Trackingsystems" : input.file.originalFilename),
      originalFilename: input.file.originalFilename,
      storedFilename: stored.storageKey,
      mimeType: stored.mimeType,
      extension: stored.extension,
      fileSize: stored.fileSize,
      checksum: stored.checksum,
      status: data.customerVisible ? "APPROVED" : "UNDER_REVIEW",
      providerName: data.providerName || null,
      externalReportReference: data.externalReportReference || null,
      reportDate: data.reportDate ?? null,
      customerVisible: false,
      reviewStatus: "PENDING",
      uploadedById: input.actor.id,
      versions: {
        create: {
          version: 1,
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
  startTime?: Date;
  endTime?: Date;
  deliveredFlyerQuantity?: number;
  remainingFlyerQuantity?: number;
}) {
  const existing = await prisma.distributionTour.findFirst({ where: { orderId: input.orderId }, orderBy: { updatedAt: "desc" } });
  if (existing) return existing;
  const order = await prisma.order.findUnique({ where: { id: input.orderId }, select: { id: true, flyerQuantity: true, assignedDistributorId: true } });
  if (!order) throw new Error("Auftrag wurde nicht gefunden.");
  const distributor = order.assignedDistributorId
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

export async function prepareExternalReportForOrder(input: {
  actor: SessionUser;
  orderId: string;
  payload: unknown;
}) {
  const data = externalReportPrepareSchema.parse(input.payload);
  const order = await prisma.order.findUnique({ where: { id: input.orderId }, include: { customer: true } });
  if (!order) throw new Error("Auftrag wurde nicht gefunden.");
  const evidenceDocuments = await prisma.document.findMany({
    where: { orderId: order.id, documentType: "REPORT" },
    orderBy: { uploadedAt: "desc" },
  });
  const gpsDocument = evidenceDocuments.find((document) => document.providerName || document.extension === "pdf") ?? evidenceDocuments[0];
  if (!gpsDocument) throw new Error("Bitte zuerst einen externen GPS-Bericht hochladen.");

  const tour = await ensureManualEvidenceTour({
    orderId: order.id,
    startTime: data.startTime,
    endTime: data.endTime,
    deliveredFlyerQuantity: data.deliveredFlyerQuantity,
    remainingFlyerQuantity: data.remainingFlyerQuantity,
  });
  const now = new Date();
  const delivered = data.deliveredFlyerQuantity ?? order.flyerQuantity;
  const remaining = data.remainingFlyerQuantity ?? Math.max(order.flyerQuantity - delivered, 0);
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
      actualStartedAt: data.startTime ?? null,
      actualCompletedAt: data.endTime ?? null,
      summary: data.summary || "Nachweis basiert auf externem GPS-Bericht und manueller Pruefung.",
      deviationSummary: data.deviationSummary || null,
      reportSnapshot: {
        source: "EXTERNAL_GPS_REPORT",
        generatedAt: now.toISOString(),
        evidenceDocumentIds: evidenceDocuments.map((document) => document.id),
        gpsDocumentId: gpsDocument.id,
        externalProvider: gpsDocument.providerName,
        externalReportReference: gpsDocument.externalReportReference,
        plannedFlyerQuantity: order.flyerQuantity,
        deliveredFlyerQuantity: delivered,
        remainingFlyerQuantity: remaining,
        summary: data.summary || "Nachweis basiert auf externem GPS-Bericht und manueller Pruefung.",
        customerNote: data.customerNote || null,
      },
      calculationVersion: "external-evidence-mvp-v1",
      coverageMode: "external_gps_manual_review",
    },
    create: {
      orderId: order.id,
      tourId: tour.id,
      customerId: order.customerId,
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
      actualStartedAt: data.startTime ?? null,
      actualCompletedAt: data.endTime ?? null,
      summary: data.summary || "Nachweis basiert auf externem GPS-Bericht und manueller Pruefung.",
      deviationSummary: data.deviationSummary || null,
      reportSnapshot: {
        source: "EXTERNAL_GPS_REPORT",
        generatedAt: now.toISOString(),
        evidenceDocumentIds: evidenceDocuments.map((document) => document.id),
        gpsDocumentId: gpsDocument.id,
        externalProvider: gpsDocument.providerName,
        externalReportReference: gpsDocument.externalReportReference,
        plannedFlyerQuantity: order.flyerQuantity,
        deliveredFlyerQuantity: delivered,
        remainingFlyerQuantity: remaining,
        summary: data.summary || "Nachweis basiert auf externem GPS-Bericht und manueller Pruefung.",
        customerNote: data.customerNote || null,
      },
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
    message: `${order.orderNumber}: GPS-Nachweis wurde fuer die Pruefung vorbereitet.`,
  });
  return report;
}

export async function publishExternalReport(input: { actor: SessionUser; reportId: string }) {
  const report = await prisma.report.update({
    where: { id: input.reportId },
    data: {
      status: "PUBLISHED",
      internalReviewStatus: "APPROVED",
      approvedById: input.actor.id,
      approvedAt: new Date(),
      reviewedById: input.actor.id,
      reviewedAt: new Date(),
      publishedAt: new Date(),
    },
    include: { customer: true },
  });
  await prisma.document.updateMany({
    where: { orderId: report.orderId, documentType: { in: ["REPORT", "IMAGE"] }, status: "APPROVED" },
    data: { customerVisible: true, reviewStatus: "APPROVED" },
  });
  await createAuditLog({ userId: input.actor.id, action: "external_report.published", entityType: "Report", entityId: report.id });
  await createNotification({
    userId: report.customer.userId,
    type: "REPORT_PUBLISHED",
    title: "Verteilbericht verfuegbar",
    message: "Ihr Verteilbericht mit GPS-Nachweis des eingesetzten Trackingsystems ist verfuegbar.",
  });
  return report;
}

export async function requireAdminEvidenceSession() {
  return requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
}
