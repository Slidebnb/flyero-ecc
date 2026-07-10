import { createHash, randomBytes } from "node:crypto";
import { Prisma, ReportStatus, ReportTemplate } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";
import { writeGeneratedAsset } from "@/lib/generatedAssets";
import { createMapSnapshotPlaceholder } from "@/lib/mapSnapshot";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { analyzeRoute, normalizeRoutePoint, type RouteAnalysis } from "@/lib/routeAnalysis";
import { generateSettingsNumber, getBrandingSettings, getCompanySettings } from "@/lib/settings";

type ReportData = Awaited<ReturnType<typeof collectReportData>>;

export async function generateReportNumber() {
  return generateSettingsNumber("report");
}

function generateVerificationCode() {
  return `VRF-${randomBytes(8).toString("hex").toUpperCase()}`;
}

export function generateOnlineReportUrl(reportId: string) {
  return `/customer/reports/${reportId}`;
}

export function gpsQualityScore(analysis: RouteAnalysis) {
  let score = 100;
  const penalties: Record<string, number> = {
    NO_GPS: 70,
    TOO_FEW_POINTS: 25,
    LARGE_GAP: 15,
    UNREALISTIC_SPEED: 20,
    NO_MOVEMENT: 15,
    MISSING_START: 10,
    MISSING_END: 10,
    OUTSIDE_TARGET_AREA: 15,
  };
  for (const flag of analysis.flags) {
    score -= penalties[flag] ?? 5;
  }
  if (analysis.gaps > 1) score -= Math.min(analysis.gaps * 5, 20);
  return Math.max(Math.min(score, 100), 0);
}

export function gpsQualityLabel(score: number) {
  if (score >= 85) return "Sehr gut";
  if (score >= 65) return "Gut";
  if (score >= 40) return "Eingeschraenkt";
  return "Unzureichend";
}

export function customerGpsStatus(score: number, pointCount: number) {
  if (pointCount < 3) return "GPS-Nachweis wird geprueft";
  if (score >= 75) return "GPS-Nachweis vollstaendig";
  return "GPS-Nachweis mit Einschraenkungen";
}

function anonymousDistributor(distributorId: string) {
  return `Verteiler #${distributorId.slice(-4).toUpperCase()}`;
}

function percent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}

function decimalPercent(value: number) {
  return new Prisma.Decimal(percent(value).toFixed(2));
}

function safeJson<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function flyerQuantitySummary(input: {
  plannedFlyers: number;
  remainingFlyers?: number | null;
  deliveredFlyers?: number | null;
}) {
  const planned = Math.max(input.plannedFlyers, 0);
  const remaining = Math.max(input.remainingFlyers ?? 0, 0);
  const delivered = Math.max(input.deliveredFlyers ?? planned - remaining, 0);
  return {
    planned,
    delivered,
    remaining,
    flyerCoveragePercent: planned > 0 ? percent((delivered / planned) * 100) : 0,
  };
}

export function calculateCoverageSummary(input: {
  plannedFlyers: number;
  deliveredFlyers: number;
  gpsScore: number;
  plannedHouseholds?: number | null;
}) {
  const flyerCoveragePercent = input.plannedFlyers > 0 ? percent((input.deliveredFlyers / input.plannedFlyers) * 100) : 0;
  const gpsFactor = input.gpsScore >= 85 ? 1 : input.gpsScore >= 65 ? 0.95 : input.gpsScore >= 40 ? 0.82 : 0.55;
  const reportActualCoveragePercent = percent(Math.min(flyerCoveragePercent, 100) * gpsFactor);
  return {
    flyerCoveragePercent,
    areaCoveragePercent: null as number | null,
    householdCoverageEstimate: reportActualCoveragePercent,
    actualCoveragePercent: reportActualCoveragePercent,
    estimatedReachedHouseholds: input.plannedHouseholds ? Math.round((input.plannedHouseholds * reportActualCoveragePercent) / 100) : null,
  };
}

function approvedCustomerPhotos(photos: ReportData["tour"]["photoProofs"]) {
  return photos.filter((photo) => photo.customerVisible && photo.reviewStatus === "APPROVED");
}

function buildReportSnapshot(data: ReportData) {
  const quantities = flyerQuantitySummary({
    plannedFlyers: data.tour.plannedFlyerQuantity ?? data.order.flyerQuantity,
    remainingFlyers: data.tour.remainingFlyers,
    deliveredFlyers: data.tour.deliveredFlyerQuantity,
  });
  const coverage = calculateCoverageSummary({
    plannedFlyers: quantities.planned,
    deliveredFlyers: quantities.delivered,
    gpsScore: data.qualityScore,
    plannedHouseholds: data.order.estimatedHouseholds,
  });
  const photos = approvedCustomerPhotos(data.tour.photoProofs);
  return {
    reportVersion: data.tour.reports[0]?.reportVersion ?? data.tour.reports[0]?.version ?? 1,
    calculationVersion: "distribution-report-v1",
    generatedAt: new Date().toISOString(),
    planned: {
      areaGeometry: data.order.targetAreaGeoJson ?? data.tour.plannedAreaGeometry ?? null,
      areaName: data.order.targetAreaName,
      city: data.order.city,
      postalCode: data.order.postalCode,
      flyerQuantity: quantities.planned,
      householdCount: data.order.estimatedHouseholds,
      startDate: data.order.preferredStartDate,
      endDate: data.order.preferredEndDate,
    },
    actual: {
      routeGeometry: data.tour.actualRouteGeometry ?? {
        type: "LineString",
        coordinates: data.tour.gpsPoints.map((point) => [Number(point.lng), Number(point.lat)]),
      },
      areaGeometry: data.tour.actualAreaGeometry ?? null,
      startedAt: data.analysis.startTime,
      completedAt: data.analysis.endTime,
      distanceMeters: data.analysis.distanceMeters,
      durationSeconds: data.analysis.activeSeconds,
      deliveredFlyerQuantity: quantities.delivered,
      remainingFlyerQuantity: quantities.remaining,
    },
    gps: {
      pointCount: data.analysis.pointCount,
      qualityScore: data.qualityScore,
      qualityLabel: data.qualityLabel,
      customerStatus: customerGpsStatus(data.qualityScore, data.analysis.pointCount),
      flags: data.analysis.flags,
    },
    coverage,
    photos: photos.map((photo) => ({
      id: photo.id,
      category: photo.category,
      caption: photo.caption,
      takenAt: photo.takenAt ?? photo.createdAt,
      uploadedAt: photo.uploadedAt,
    })),
    deviations: data.deviations
      .filter((deviation) => deviation.customerVisible)
      .map((deviation) => ({
        type: deviation.type,
        severity: deviation.severity,
        description: deviation.description,
        resolution: deviation.resolution,
      })),
    customerText: {
      coverageExplanation:
        "Das geplante Gebiet wurde anhand der verfuegbaren Tour- und Nachweisdaten dokumentiert. Der Wert ist kein Einzelbriefkasten-Nachweis.",
      privacyNote: "Personenbezogene Verteiler- und Rohdaten werden geschuetzt.",
    },
  };
}

export async function collectReportData(tourId: string) {
  const tour = await prisma.distributionTour.findUnique({
    where: { id: tourId },
    include: {
      order: { include: { customer: true, distributionArea: true } },
      distributor: { include: { user: true } },
      gpsPoints: { orderBy: { recordedAt: "asc" } },
      photoProofs: { orderBy: { createdAt: "asc" } },
      deviations: { orderBy: { createdAt: "asc" } },
      reports: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!tour) throw new Error("Tour wurde nicht gefunden.");

  const analysis = analyzeRoute({
    points: tour.gpsPoints.map(normalizeRoutePoint),
    pauseSeconds: tour.totalPauseSeconds,
    targetAreaGeoJson: tour.order.targetAreaGeoJson,
  });
  const qualityScore = gpsQualityScore(analysis);
  const mapSnapshot = await createMapSnapshotPlaceholder({
    tourId: tour.id,
    routePath: tour.gpsPoints.map((point) => ({ lat: Number(point.lat), lng: Number(point.lng) })),
    analysis,
  });

  return {
    tour,
    order: tour.order,
    customer: tour.order.customer,
    analysis,
    qualityScore,
    qualityLabel: gpsQualityLabel(qualityScore),
    mapSnapshot,
    anonymousDistributor: anonymousDistributor(tour.distributorId),
    deviations: await prisma.distributionDeviation.findMany({
      where: { orderId: tour.orderId },
      orderBy: { createdAt: "asc" },
    }),
  };
}

export function sanitizeReportForCustomer(data: ReportData) {
  const quantities = flyerQuantitySummary({
    plannedFlyers: data.tour.plannedFlyerQuantity ?? data.order.flyerQuantity,
    remainingFlyers: data.tour.remainingFlyers,
    deliveredFlyers: data.tour.deliveredFlyerQuantity,
  });
  const coverage = calculateCoverageSummary({
    plannedFlyers: quantities.planned,
    deliveredFlyers: quantities.delivered,
    gpsScore: data.qualityScore,
    plannedHouseholds: data.order.estimatedHouseholds,
  });
  const photos = approvedCustomerPhotos(data.tour.photoProofs);
  return {
    order: {
      orderNumber: data.order.orderNumber,
      customerCompany: data.customer.companyName,
      area: data.order.targetAreaName,
      city: data.order.city,
      postalCode: data.order.postalCode,
      flyerQuantity: data.order.flyerQuantity,
      estimatedHouseholds: data.order.estimatedHouseholds,
      preferredStartDate: data.order.preferredStartDate,
      preferredEndDate: data.order.preferredEndDate,
    },
    tour: {
      startTime: data.analysis.startTime,
      endTime: data.analysis.endTime,
      durationSeconds: data.analysis.totalDurationSeconds,
      activeSeconds: data.analysis.activeSeconds,
      distanceMeters: data.analysis.distanceMeters,
      remainingFlyers: data.tour.remainingFlyers,
      distributor: data.anonymousDistributor,
    },
    quantities,
    coverage,
    gpsQuality: {
      score: data.qualityScore,
      label: data.qualityLabel,
      customerStatus: customerGpsStatus(data.qualityScore, data.analysis.pointCount),
    },
    photos: photos.map((photo) => ({
      id: photo.id,
      url: photo.url,
      takenAt: photo.takenAt ?? photo.createdAt,
      lat: photo.lat ? Number(photo.lat) : null,
      lng: photo.lng ? Number(photo.lng) : null,
      caption: photo.caption,
      category: photo.category,
    })),
    route: data.tour.gpsPoints.map((point) => ({
      lat: Number(point.lat),
      lng: Number(point.lng),
      recordedAt: point.recordedAt,
    })),
    deviations: data.deviations
      .filter((deviation) => deviation.customerVisible)
      .map((deviation) => ({
        description: deviation.description,
        resolution: deviation.resolution,
        severity: deviation.severity,
      })),
    mapSnapshot: data.mapSnapshot,
  };
}

function escapePdfText(value: unknown) {
  return String(value ?? "-").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildSimplePdf(lines: string[]) {
  const objects: string[] = [];
  const content = [
    "BT",
    "/F1 18 Tf",
    "50 790 Td",
    ...lines.flatMap((line, index) => [
      index === 0 ? "" : "0 -24 Td",
      `(${escapePdfText(line).slice(0, 110)}) Tj`,
    ]),
    "ET",
  ].filter(Boolean).join("\n");
  objects.push("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj");
  objects.push("2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj");
  objects.push("3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj");
  objects.push("4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj");
  objects.push(`5 0 obj << /Length ${Buffer.byteLength(content)} >> stream\n${content}\nendstream endobj`);
  let offset = "%PDF-1.4\n".length;
  const xref = ["0000000000 65535 f "];
  const body = objects.map((object) => {
    xref.push(`${String(offset).padStart(10, "0")} 00000 n `);
    offset += Buffer.byteLength(`${object}\n`);
    return `${object}\n`;
  }).join("");
  const xrefOffset = offset;
  return Buffer.from(
    `%PDF-1.4\n${body}xref\n0 ${objects.length + 1}\n${xref.join("\n")}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  );
}

export async function generatePdf(reportId: string) {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { tour: true },
  });
  if (!report) throw new Error("Report wurde nicht gefunden.");
  const data = await collectReportData(report.tourId);
  const customer = sanitizeReportForCustomer(data);
  const [company, branding] = await Promise.all([getCompanySettings(), getBrandingSettings()]);
  const lines = [
    `${company.companyName} Verteilbericht`,
    `Berichtnummer: ${report.reportNumber}`,
    `Prüfcode: ${report.verificationCode}`,
    `Auftrag: ${customer.order.orderNumber}`,
    `Kunde: ${customer.order.customerCompany}`,
    `Gebiet: ${customer.order.area}, ${customer.order.city} ${customer.order.postalCode}`,
    `Flyeranzahl: ${customer.order.flyerQuantity}`,
    `Haushalte geschaetzt: ${customer.order.estimatedHouseholds ?? "-"}`,
    `Zeitraum: ${formatDateTime(customer.order.preferredStartDate)} bis ${formatDateTime(customer.order.preferredEndDate)}`,
    `Start: ${formatDateTime(customer.tour.startTime)}`,
    `Ende: ${formatDateTime(customer.tour.endTime)}`,
    `Dauer: ${customer.tour.durationSeconds}s, aktiv ${customer.tour.activeSeconds}s`,
    `Strecke: ${customer.tour.distanceMeters} m`,
    `GPS-Qualitaet: ${customer.gpsQuality.label} (${customer.gpsQuality.score}/100)`,
    `Restflyer: ${customer.tour.remainingFlyers ?? 0}`,
    `Fotos: ${customer.photos.length}`,
    `Karte: ${customer.mapSnapshot.provider} / ${customer.mapSnapshot.message}`,
    "Adminfreigabe: digital dokumentiert",
    `Digitale Kennung: ${report.checksum ?? "-"}`,
    `Footer: ${branding.reportFooterText || `${company.companyName} / Seite 1 von 1`} / Bericht-ID ${report.id}`,
  ];
  const pdf = buildSimplePdf(lines);
  const fileName = `${report.reportNumber.toLowerCase()}.pdf`;
  const stored = await writeGeneratedAsset({ kind: "reports", fileName, buffer: pdf });
  const checksum = createHash("sha256").update(pdf).digest("hex");
  const pdfUrl = stored.storagePath;
  await prisma.report.update({
    where: { id: report.id },
    data: { pdfUrl, checksum },
  });
  return { pdfUrl, checksum, filePath: stored.absolutePath };
}

export async function createReportForTour(input: {
  tourId: string;
  adminUserId: string;
  template?: ReportTemplate;
}) {
  const data = await collectReportData(input.tourId);
  if (data.tour.status !== "APPROVED") throw new Error("Berichte können nur für freigegebene Touren erzeugt werden.");
  const existing = await prisma.report.findUnique({ where: { tourId: input.tourId } });
  const now = new Date();
  const snapshot = buildReportSnapshot(data);
  const quantities = flyerQuantitySummary({
    plannedFlyers: data.tour.plannedFlyerQuantity ?? data.order.flyerQuantity,
    remainingFlyers: data.tour.remainingFlyers,
    deliveredFlyers: data.tour.deliveredFlyerQuantity,
  });
  const coverage = calculateCoverageSummary({
    plannedFlyers: quantities.planned,
    deliveredFlyers: quantities.delivered,
    gpsScore: data.qualityScore,
    plannedHouseholds: data.order.estimatedHouseholds,
  });
  let report: Awaited<ReturnType<typeof prisma.report.upsert>> | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const reportNumber = existing?.reportNumber ?? await generateReportNumber();
    try {
      report = await prisma.report.upsert({
        where: { tourId: input.tourId },
        update: {
          status: "READY_FOR_REVIEW",
          template: input.template ?? "STANDARD",
          generatedAt: now,
          approvedAt: data.tour.reviewedAt ?? now,
          approvedById: data.tour.reviewedBy ?? input.adminUserId,
          reviewedAt: data.tour.reviewedAt ?? now,
          reviewedById: data.tour.reviewedBy ?? input.adminUserId,
          internalReviewStatus: "IN_REVIEW",
          version: { increment: 1 },
          reportVersion: { increment: 1 },
          plannedAreaGeometry: data.order.targetAreaGeoJson ?? data.tour.plannedAreaGeometry ?? undefined,
          actualAreaGeometry: data.tour.actualAreaGeometry ?? undefined,
          actualRouteGeometry: snapshot.actual.routeGeometry,
          coverageMode: "conservative_gps_photo_review",
          plannedHouseholdCount: data.order.estimatedHouseholds,
          estimatedReachedHouseholds: coverage.estimatedReachedHouseholds,
          plannedFlyerQuantity: quantities.planned,
          deliveredFlyerQuantity: quantities.delivered,
          remainingFlyerQuantity: quantities.remaining,
          actualCoveragePercent: decimalPercent(coverage.actualCoveragePercent),
          flyerCoveragePercent: decimalPercent(coverage.flyerCoveragePercent),
          householdCoverageEstimate: decimalPercent(coverage.householdCoverageEstimate),
          actualDistanceKm: new Prisma.Decimal((data.analysis.distanceMeters / 1000).toFixed(2)),
          actualDurationMinutes: Math.round(data.analysis.activeSeconds / 60),
          distributorCount: 1,
          plannedStartDate: data.order.preferredStartDate,
          actualStartedAt: data.analysis.startTime,
          actualCompletedAt: data.analysis.endTime,
          summary: "Verteilung aus echten Tourdaten, GPS-Nachweis und freigegebenen Fotos vorbereitet.",
          deviationSummary: data.deviations.filter((deviation) => deviation.customerVisible).map((deviation) => deviation.description).join(" ") || null,
          calculationVersion: "distribution-report-v1",
          reportSnapshot: safeJson(snapshot),
        },
        create: {
          orderId: data.order.id,
          tourId: data.tour.id,
          customerId: data.customer.id,
          reportNumber,
          status: "READY_FOR_REVIEW",
          reportType: "DISTRIBUTION_PROOF",
          template: input.template ?? "STANDARD",
          onlineUrl: "",
          generatedAt: now,
          approvedAt: data.tour.reviewedAt ?? now,
          approvedById: data.tour.reviewedBy ?? input.adminUserId,
          reviewedAt: data.tour.reviewedAt ?? now,
          reviewedById: data.tour.reviewedBy ?? input.adminUserId,
          internalReviewStatus: "IN_REVIEW",
          plannedAreaGeometry: data.order.targetAreaGeoJson ?? data.tour.plannedAreaGeometry ?? undefined,
          actualAreaGeometry: data.tour.actualAreaGeometry ?? undefined,
          actualRouteGeometry: snapshot.actual.routeGeometry,
          coverageMode: "conservative_gps_photo_review",
          plannedHouseholdCount: data.order.estimatedHouseholds,
          estimatedReachedHouseholds: coverage.estimatedReachedHouseholds,
          plannedFlyerQuantity: quantities.planned,
          deliveredFlyerQuantity: quantities.delivered,
          remainingFlyerQuantity: quantities.remaining,
          actualCoveragePercent: decimalPercent(coverage.actualCoveragePercent),
          flyerCoveragePercent: decimalPercent(coverage.flyerCoveragePercent),
          householdCoverageEstimate: decimalPercent(coverage.householdCoverageEstimate),
          actualDistanceKm: new Prisma.Decimal((data.analysis.distanceMeters / 1000).toFixed(2)),
          actualDurationMinutes: Math.round(data.analysis.activeSeconds / 60),
          distributorCount: 1,
          plannedStartDate: data.order.preferredStartDate,
          actualStartedAt: data.analysis.startTime,
          actualCompletedAt: data.analysis.endTime,
          summary: "Verteilung aus echten Tourdaten, GPS-Nachweis und freigegebenen Fotos vorbereitet.",
          deviationSummary: data.deviations.filter((deviation) => deviation.customerVisible).map((deviation) => deviation.description).join(" ") || null,
          calculationVersion: "distribution-report-v1",
          reportSnapshot: safeJson(snapshot),
          verificationCode: generateVerificationCode(),
        },
      });
      break;
    } catch (error) {
      const target = error instanceof Prisma.PrismaClientKnownRequestError ? error.meta?.target : null;
      const isReportNumberCollision =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        (!target || target === "(not available)" || (Array.isArray(target) && target.includes("reportNumber")));
      if (!isReportNumberCollision || attempt === 2) throw error;
    }
  }
  if (!report) throw new Error("Bericht konnte nicht erstellt werden.");
  const onlineUrl = generateOnlineReportUrl(report.id);
  const pdf = await generatePdf(report.id);
  const updated = await prisma.report.update({
    where: { id: report.id },
    data: { onlineUrl, pdfUrl: pdf.pdfUrl, checksum: pdf.checksum },
  });
  await createAuditLog({
    userId: input.adminUserId,
    action: existing ? "report.regenerated" : "report.generated",
    entityType: "Report",
    entityId: updated.id,
    newValues: { reportNumber: updated.reportNumber, pdfUrl: updated.pdfUrl, version: updated.version },
  });
  await createNotification({
    userId: data.customer.userId,
    type: "REPORT_AVAILABLE",
    title: "Bericht verfügbar",
    message: `Der Verteilbericht ${updated.reportNumber} wurde erzeugt.`,
  });
  await notifyAdmins({
    type: "REPORT_GENERATED",
    title: "Bericht generiert",
    message: `${updated.reportNumber} für ${data.order.orderNumber} wurde erzeugt.`,
  });
  return updated;
}

export async function regenerateReport(input: { reportId: string; adminUserId: string }) {
  const report = await prisma.report.findUnique({ where: { id: input.reportId } });
  if (!report) throw new Error("Report wurde nicht gefunden.");
  return createReportForTour({ tourId: report.tourId, adminUserId: input.adminUserId, template: report.template });
}

export async function approveReport(input: { reportId: string; adminUserId: string }) {
  const report = await prisma.report.update({
    where: { id: input.reportId },
    data: {
      status: "APPROVED",
      internalReviewStatus: "APPROVED",
      reviewedById: input.adminUserId,
      reviewedAt: new Date(),
      approvedById: input.adminUserId,
      approvedAt: new Date(),
    },
  });
  await createAuditLog({ userId: input.adminUserId, action: "report.approved", entityType: "Report", entityId: report.id });
  return report;
}

export async function requestReportCorrection(input: { reportId: string; adminUserId: string; message?: string }) {
  const report = await prisma.report.update({
    where: { id: input.reportId },
    data: {
      status: "CHANGES_REQUIRED",
      internalReviewStatus: "NEEDS_CORRECTION",
      reviewedById: input.adminUserId,
      reviewedAt: new Date(),
      deviationSummary: input.message ?? "Korrektur vor Kundenfreigabe erforderlich.",
    },
  });
  await createAuditLog({
    userId: input.adminUserId,
    action: "report.correction_required",
    entityType: "Report",
    entityId: report.id,
    newValues: { message: input.message },
  });
  return report;
}

export async function publishReport(input: { reportId: string; adminUserId: string }) {
  const current = await prisma.report.findUnique({
    where: { id: input.reportId },
    include: { customer: true, order: true },
  });
  if (!current) throw new Error("Report wurde nicht gefunden.");
  if (current.status === "PUBLISHED") return current;
  if (!current.reportSnapshot) throw new Error("Bericht kann erst nach Snapshot-Erzeugung veroeffentlicht werden.");
  const report = await prisma.report.update({
    where: { id: input.reportId },
    data: {
      status: "PUBLISHED",
      internalReviewStatus: "APPROVED",
      reviewedById: input.adminUserId,
      reviewedAt: new Date(),
      publishedAt: new Date(),
      approvedById: input.adminUserId,
      approvedAt: new Date(),
    },
    include: { customer: true, order: true },
  });
  await createAuditLog({ userId: input.adminUserId, action: "report.published", entityType: "Report", entityId: report.id });
  await createNotification({
    userId: report.customer.userId,
    type: "REPORT_PUBLISHED",
    title: "Bericht veröffentlicht",
    message: `Der Verteilbericht ${report.reportNumber} ist verfügbar.`,
  });
  await notifyAdmins({
    type: "REPORT_PUBLISHED",
    title: "Bericht veröffentlicht",
    message: `${report.reportNumber} für ${report.order.orderNumber} wurde veröffentlicht.`,
  });
  return report;
}

export async function archiveReport(input: { reportId: string; adminUserId: string }) {
  const report = await prisma.report.update({
    where: { id: input.reportId },
    data: { status: "ARCHIVED" },
  });
  await createAuditLog({ userId: input.adminUserId, action: "report.archived", entityType: "Report", entityId: report.id });
  return report;
}

export async function markReportDownloaded(input: { reportId: string; userId?: string | null }) {
  const report = await prisma.report.update({
    where: { id: input.reportId },
    data: { downloadedAt: new Date() },
  });
  await createAuditLog({ userId: input.userId, action: "report.downloaded", entityType: "Report", entityId: report.id });
  return report;
}

export function isCustomerVisibleReportStatus(status: ReportStatus) {
  return status === "PUBLISHED";
}
