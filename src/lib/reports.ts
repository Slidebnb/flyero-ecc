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
  return "Auffaellig";
}

function anonymousDistributor(distributorId: string) {
  return `Verteiler #${distributorId.slice(-4).toUpperCase()}`;
}

export async function collectReportData(tourId: string) {
  const tour = await prisma.distributionTour.findUnique({
    where: { id: tourId },
    include: {
      order: { include: { customer: true, distributionArea: true } },
      distributor: { include: { user: true } },
      gpsPoints: { orderBy: { recordedAt: "asc" } },
      photoProofs: { orderBy: { createdAt: "asc" } },
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
  };
}

export function sanitizeReportForCustomer(data: ReportData) {
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
    gpsQuality: {
      score: data.qualityScore,
      label: data.qualityLabel,
    },
    photos: data.tour.photoProofs.map((photo) => ({
      id: photo.id,
      url: photo.url,
      takenAt: photo.takenAt ?? photo.createdAt,
      lat: photo.lat ? Number(photo.lat) : null,
      lng: photo.lng ? Number(photo.lng) : null,
    })),
    route: data.tour.gpsPoints.map((point) => ({
      lat: Number(point.lat),
      lng: Number(point.lng),
      recordedAt: point.recordedAt,
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
  let report: Awaited<ReturnType<typeof prisma.report.upsert>> | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const reportNumber = existing?.reportNumber ?? await generateReportNumber();
    try {
      report = await prisma.report.upsert({
        where: { tourId: input.tourId },
        update: {
          status: "GENERATED",
          template: input.template ?? "STANDARD",
          generatedAt: now,
          approvedAt: data.tour.reviewedAt ?? now,
          approvedById: data.tour.reviewedBy ?? input.adminUserId,
          version: { increment: 1 },
        },
        create: {
          orderId: data.order.id,
          tourId: data.tour.id,
          customerId: data.customer.id,
          reportNumber,
          status: "GENERATED",
          reportType: "DISTRIBUTION_PROOF",
          template: input.template ?? "STANDARD",
          onlineUrl: "",
          generatedAt: now,
          approvedAt: data.tour.reviewedAt ?? now,
          approvedById: data.tour.reviewedBy ?? input.adminUserId,
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

export async function publishReport(input: { reportId: string; adminUserId: string }) {
  const report = await prisma.report.update({
    where: { id: input.reportId },
    data: { status: "PUBLISHED" },
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
  return status === "PUBLISHED" || status === "APPROVED" || status === "GENERATED";
}
