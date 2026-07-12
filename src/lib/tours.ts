import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { writeGeneratedAsset } from "@/lib/generatedAssets";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { approvalRequiresCleanScan, scanFileBuffer } from "@/lib/fileScanning";
import { generateOnlineReportUrl, generateReportNumber, gpsQualityScore } from "@/lib/reports";
import { analyzeRoute, normalizeRoutePoint } from "@/lib/routeAnalysis";
import { logWarehouseHistory } from "@/lib/warehouse";

type GpsPointInput = {
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  battery?: number;
  recordedAt?: Date;
  source?: string;
  clientId?: string;
  sequence?: number;
  status?: string;
};

function decimal(value?: number) {
  return value === undefined || Number.isNaN(value) ? undefined : new Prisma.Decimal(value);
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const radius = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * radius * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function routeLineString(points: Array<{ lat: Prisma.Decimal | number | string; lng: Prisma.Decimal | number | string }>) {
  if (points.length < 2) return undefined;
  return {
    type: "LineString",
    coordinates: points.map((point) => [Number(point.lng.toString()), Number(point.lat.toString())]),
  };
}

function decodeImageDataUrl(imageDataUrl?: string) {
  const match = imageDataUrl?.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error("Foto muss als gueltige Data-URL hochgeladen werden.");
  const mimeType = match[1];
  const extension =
    mimeType === "image/jpeg" ? "jpg"
    : mimeType === "image/png" ? "png"
    : mimeType === "image/webp" ? "webp"
    : null;
  if (!extension) throw new Error("Nur PNG, JPG oder WEBP Fotos werden unterstuetzt.");
  const encoded = match[2];
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 === 1) {
    throw new Error("Foto enthält keine gültigen Base64-Daten.");
  }
  const buffer = Buffer.from(encoded, "base64");
  const signatureMatches =
    (extension === "jpg" && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) ||
    (extension === "png" && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
    (extension === "webp" && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP");
  if (!signatureMatches) throw new Error("Foto-Dateityp und tatsächlicher Dateiinhalt stimmen nicht überein.");
  if (buffer.byteLength > Number(process.env.TOUR_PHOTO_MAX_FILE_SIZE_BYTES || 10 * 1024 * 1024)) {
    throw new Error("Das Foto ist zu groß. Maximal erlaubt sind 10 MB.");
  }
  return {
    mimeType,
    extension,
    buffer,
  };
}

function parseQrPayload(qrCode: string) {
  try {
    const parsed = JSON.parse(qrCode) as { inventoryId?: string; orderNumber?: string };
    return parsed.inventoryId ? parsed : null;
  } catch {
    return null;
  }
}

export async function getDistributorProfileForUser(userId: string) {
  const profile = await prisma.distributorProfile.findUnique({ where: { userId } });
  if (!profile) {
    throw new Error("Verteilerprofil wurde nicht gefunden.");
  }
  if (profile.reviewStatus !== "APPROVED") {
    throw new Error("Verteilerprofil ist noch nicht freigegeben.");
  }
  return profile;
}

export async function assignTour(input: {
  inventoryId: string;
  distributorId: string;
  adminUserId: string;
}) {
  const inventory = await prisma.warehouseInventory.findUnique({
    where: { id: input.inventoryId },
    include: { order: true, warehouseLocation: { include: { warehouse: true } } },
  });
  if (!inventory) throw new Error("Lagerbestand wurde nicht gefunden.");
  if (inventory.status !== "READY_FOR_PICKUP") {
    throw new Error("Nur abholbereite Lagerbestaende können zugewiesen werden.");
  }

  const distributor = await prisma.distributorProfile.findUnique({
    where: { id: input.distributorId },
    include: { user: true },
  });
  if (!distributor || distributor.reviewStatus !== "APPROVED") {
    throw new Error("Verteiler ist nicht freigegeben.");
  }

  const tour = await prisma.distributionTour.upsert({
    where: {
      id:
        (
          await prisma.distributionTour.findFirst({
            where: { inventoryId: inventory.id, status: { notIn: ["COMPLETED", "APPROVED", "CANCELLED"] } },
            select: { id: true },
          })
        )?.id ?? "__new_tour__",
    },
    update: {
      distributorId: distributor.id,
      status: "ASSIGNED",
    },
    create: {
      orderId: inventory.orderId,
      inventoryId: inventory.id,
      distributorId: distributor.id,
      status: "ASSIGNED",
    },
  }).catch(async () =>
    prisma.distributionTour.create({
      data: {
        orderId: inventory.orderId,
        inventoryId: inventory.id,
        distributorId: distributor.id,
        status: "ASSIGNED",
      },
    }),
  );

  await prisma.warehouseInventory.update({
    where: { id: inventory.id },
    data: { reservedDistributorId: distributor.id, pickupStatus: "RESERVED" },
  });
  await createAuditLog({
    userId: input.adminUserId,
    action: "tour.assigned",
    entityType: "DistributionTour",
    entityId: tour.id,
    newValues: { inventoryId: inventory.id, distributorId: distributor.id },
  });
  await createNotification({
    userId: distributor.userId,
    type: "TOUR_ASSIGNED",
    title: "Neue Tour",
    message: `Tour für Auftrag ${inventory.order.orderNumber} wurde zugewiesen.`,
  });
  return tour;
}

export async function confirmPickup(input: {
  tourId: string;
  userId: string;
  qrCode: string;
}) {
  const profile = await getDistributorProfileForUser(input.userId);
  const tour = await prisma.distributionTour.findFirst({
    where: { id: input.tourId, distributorId: profile.id },
    include: { inventory: { include: { order: true } } },
  });
  if (!tour || !tour.inventory) throw new Error("Tour wurde nicht gefunden.");
  const payload = parseQrPayload(input.qrCode);
  if (!payload || payload.inventoryId !== tour.inventoryId) {
    throw new Error("QR-Code passt nicht zu dieser Tour.");
  }
  if (tour.inventory.reservedDistributorId !== profile.id) {
    throw new Error("Diese Abholung ist einem anderen Verteiler zugewiesen.");
  }
  if (tour.inventory.status !== "READY_FOR_PICKUP") {
    throw new Error("Lagerbestand ist nicht abholbereit.");
  }

  const now = new Date();
  const [updatedTour] = await prisma.$transaction([
    prisma.distributionTour.update({
      where: { id: tour.id },
      data: { status: "PICKED_UP", pickupTime: now },
    }),
    prisma.warehouseInventory.update({
      where: { id: tour.inventory.id },
      data: { status: "PICKED_UP", pickupStatus: "PICKED_UP", pickedUpAt: now },
    }),
  ]);
  await logWarehouseHistory({
    inventoryId: tour.inventory.id,
    action: "tour.pickup",
    userId: input.userId,
    newValue: { tourId: tour.id, distributorId: profile.id },
  });
  await createAuditLog({
    userId: input.userId,
    action: "tour.pickup",
    entityType: "DistributionTour",
    entityId: tour.id,
    newValues: { inventoryId: tour.inventory.id },
  });
  await notifyAdmins({
    type: "TOUR_PICKUP_CONFIRMED",
    title: "Abholung bestaetigt",
    message: `Auftrag ${tour.inventory.order.orderNumber} wurde abgeholt.`,
  });
  return updatedTour;
}

export async function startTour(input: { tourId: string; userId: string; firstPoint?: GpsPointInput }) {
  const profile = await getDistributorProfileForUser(input.userId);
  const tour = await prisma.distributionTour.findFirst({ where: { id: input.tourId, distributorId: profile.id } });
  if (!tour) throw new Error("Tour wurde nicht gefunden.");
  if (tour.status !== "PICKED_UP" && tour.status !== "RESUMED") {
    throw new Error("Tour kann erst nach Abholung gestartet werden.");
  }
  const now = new Date();
  const updated = await prisma.distributionTour.update({
    where: { id: tour.id },
    data: {
      status: "STARTED",
      startTime: tour.startTime ?? now,
      startedAt: tour.startedAt ?? now,
      ...(input.firstPoint ? { startLat: decimal(input.firstPoint.lat), startLng: decimal(input.firstPoint.lng) } : {}),
    },
  });
  if (input.firstPoint) await uploadGpsPoints({ tourId: tour.id, userId: input.userId, points: [input.firstPoint] });
  await createAuditLog({ userId: input.userId, action: "tour.started", entityType: "DistributionTour", entityId: tour.id });
  await notifyAdmins({ type: "TOUR_STARTED", title: "Tour gestartet", message: `Tour ${tour.id} wurde gestartet.` });
  return updated;
}

export async function pauseTour(input: { tourId: string; userId: string }) {
  const profile = await getDistributorProfileForUser(input.userId);
  const tour = await prisma.distributionTour.findFirst({ where: { id: input.tourId, distributorId: profile.id } });
  if (!tour) throw new Error("Tour wurde nicht gefunden.");
  if (tour.status !== "STARTED" && tour.status !== "RESUMED") throw new Error("Nur laufende Touren können pausiert werden.");
  const updated = await prisma.distributionTour.update({
    where: { id: tour.id },
    data: { status: "PAUSED", pauseTime: new Date(), pausedAt: new Date() },
  });
  await createAuditLog({ userId: input.userId, action: "tour.paused", entityType: "DistributionTour", entityId: tour.id });
  return updated;
}

export async function resumeTour(input: { tourId: string; userId: string }) {
  const profile = await getDistributorProfileForUser(input.userId);
  const tour = await prisma.distributionTour.findFirst({ where: { id: input.tourId, distributorId: profile.id } });
  if (!tour) throw new Error("Tour wurde nicht gefunden.");
  if (tour.status !== "PAUSED") throw new Error("Nur pausierte Touren können fortgesetzt werden.");
  const pauseSeconds = tour.pauseTime ? Math.max(Math.floor((Date.now() - tour.pauseTime.getTime()) / 1000), 0) : 0;
  const updated = await prisma.distributionTour.update({
    where: { id: tour.id },
    data: {
      status: "RESUMED",
      totalPauseSeconds: tour.totalPauseSeconds + pauseSeconds,
      pauseTime: null,
    },
  });
  await createAuditLog({ userId: input.userId, action: "tour.resumed", entityType: "DistributionTour", entityId: tour.id });
  return updated;
}

export async function uploadGpsPoints(input: { tourId: string; userId: string; points: GpsPointInput[] }) {
  const profile = await getDistributorProfileForUser(input.userId);
  const tour = await prisma.distributionTour.findFirst({
    where: { id: input.tourId, distributorId: profile.id },
    include: { gpsPoints: { orderBy: { recordedAt: "desc" }, take: 50 } },
  });
  if (!tour) throw new Error("Tour wurde nicht gefunden.");

  let previous = tour.gpsPoints[0]
    ? { lat: Number(tour.gpsPoints[0].lat), lng: Number(tour.gpsPoints[0].lng), recordedAt: tour.gpsPoints[0].recordedAt }
    : null;
  const existingKeys = new Set(
    tour.gpsPoints.map((point) => `${point.recordedAt.toISOString()}:${Number(point.lat).toFixed(7)}:${Number(point.lng).toFixed(7)}`),
  );
  const batchKeys = new Set<string>();
  let uploadedDistance = 0;
  let duplicatePoints = 0;
  const rows = input.points.flatMap((point) => {
    const recordedAt = point.recordedAt ?? new Date();
    const key = `${recordedAt.toISOString()}:${point.lat.toFixed(7)}:${point.lng.toFixed(7)}`;
    if (existingKeys.has(key) || batchKeys.has(key)) {
      duplicatePoints += 1;
      return [];
    }
    batchKeys.add(key);
    const flags: string[] = [];
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) flags.push("gps_invalid");
    if (point.lat < -90 || point.lat > 90 || point.lng < -180 || point.lng > 180) flags.push("gps_invalid_range");
    if (point.accuracy === undefined || point.accuracy > 100) flags.push("gps_weak_or_disabled");
    else if (point.accuracy > 50) flags.push("gps_low_accuracy");
    if (point.speed !== undefined && point.speed > 13.9) flags.push("speed_high");
    if (point.battery !== undefined && point.battery <= 15) flags.push("battery_low");
    const clockDriftSeconds = Math.abs((Date.now() - recordedAt.getTime()) / 1000);
    if (clockDriftSeconds > 60 * 60) flags.push("device_time_suspicious");
    if (previous) {
      const distance = distanceMeters(previous, point);
      const seconds = Math.max((recordedAt.getTime() - previous.recordedAt.getTime()) / 1000, 1);
      uploadedDistance += distance;
      if (distance < 3 && seconds > 120) flags.push("no_movement");
      if (distance > 1500) flags.push("large_jump");
      if (seconds > 300) flags.push("time_gap");
      if (distance / seconds > 13.9) flags.push("computed_speed_high");
    }
    previous = { lat: point.lat, lng: point.lng, recordedAt };
    return {
      tourId: tour.id,
      lat: new Prisma.Decimal(point.lat),
      lng: new Prisma.Decimal(point.lng),
      accuracy: decimal(point.accuracy),
      speed: decimal(point.speed),
      heading: decimal(point.heading),
      altitude: decimal(point.altitude),
      battery: point.battery,
      source: [point.source ?? "browser", point.clientId ? point.clientId.slice(0, 48) : null, point.sequence !== undefined ? `seq:${point.sequence}` : null].filter(Boolean).join(":"),
      status: point.status ?? (flags.length ? "flagged" : "ok"),
      flags: flags.length ? flags : undefined,
      recordedAt,
      receivedAt: new Date(),
      suspicious: flags.length > 0,
    };
  });

  if (rows.length > 0) await prisma.gpsPoint.createMany({ data: rows });
  const allFlags = rows.flatMap((row) => (Array.isArray(row.flags) ? row.flags : []));
  const routePoints = await prisma.gpsPoint.findMany({
    where: { tourId: tour.id },
    orderBy: { recordedAt: "asc" },
    take: 5000,
  });
  const analysis = analyzeRoute({
    points: routePoints.map(normalizeRoutePoint),
    pauseSeconds: tour.totalPauseSeconds,
  });
  await prisma.distributionTour.update({
    where: { id: tour.id },
    data: {
      totalDistanceMeters: analysis.distanceMeters || (tour.totalDistanceMeters ?? 0) + Math.round(uploadedDistance),
      actualDistanceKm: new Prisma.Decimal((analysis.distanceMeters / 1000).toFixed(2)),
      actualRouteGeometry: routeLineString(routePoints),
      gpsPointCount: routePoints.length,
      gpsQualityScore: gpsQualityScore(analysis),
      lastLocationAt: routePoints.at(-1)?.recordedAt ?? tour.updatedAt,
      fraudFlags: allFlags.length ? { latest: allFlags } : tour.fraudFlags ?? undefined,
    },
  });
  await createAuditLog({
    userId: input.userId,
    action: "gps.uploaded",
    entityType: "DistributionTour",
    entityId: tour.id,
    newValues: { points: rows.length, duplicates: duplicatePoints, flags: allFlags },
  });
  return { count: rows.length, duplicates: duplicatePoints, flags: allFlags };
}

export async function uploadTourPhoto(input: {
  tourId: string;
  userId: string;
  imageDataUrl?: string;
  lat?: number;
  lng?: number;
  accuracy?: number;
  takenAt?: Date;
}) {
  const profile = await getDistributorProfileForUser(input.userId);
  const tour = await prisma.distributionTour.findFirst({ where: { id: input.tourId, distributorId: profile.id } });
  if (!tour) throw new Error("Tour wurde nicht gefunden.");
  const decodedPhoto = decodeImageDataUrl(input.imageDataUrl);
  const photoId = randomUUID();
  const scan = await scanFileBuffer({ buffer: decodedPhoto.buffer, originalFilename: `${photoId}.${decodedPhoto.extension}` });
  if (approvalRequiresCleanScan({ mode: scan.mode, status: scan.status })) {
    throw new Error(`Foto konnte nicht freigegeben werden: ${scan.message || "Malware-Scan nicht erfolgreich."}`);
  }
  const quarantined = scan.status !== "CLEAN" && scan.mode !== "disabled";
  const stored = await writeGeneratedAsset({
    kind: quarantined ? "quarantine" : "proofs",
    fileName: quarantined ? `proofs/${photoId}.${decodedPhoto.extension}` : `${photoId}.${decodedPhoto.extension}`,
    buffer: decodedPhoto.buffer,
    contentType: decodedPhoto.mimeType,
  });
  const photo = await prisma.photoProof.create({
    data: {
      id: photoId,
      tourId: tour.id,
      orderId: tour.orderId,
      uploadedBy: input.userId,
      url: `/api/proofs/${photoId}`,
      lat: decimal(input.lat),
      lng: decimal(input.lng),
      accuracy: decimal(input.accuracy),
      source: "camera",
      category: "DISTRIBUTION_AREA",
      customerVisible: false,
      reviewStatus: "PENDING",
      scanStatus: scan.status,
      scanProvider: scan.provider,
      scanMessage: scan.message,
      scannedAt: scan.status === "CLEAN" ? new Date() : null,
      takenAt: input.takenAt ?? new Date(),
      deviceTimestamp: input.takenAt ?? null,
      metadata: {
        storedAs: "generated-asset",
        storagePath: stored.storagePath,
        mimeType: decodedPhoto.mimeType,
      },
    },
  });
  await createAuditLog({ userId: input.userId, action: "photo.uploaded", entityType: "PhotoProof", entityId: photo.id });
  return photo;
}

export async function completeTour(input: {
  tourId: string;
  userId: string;
  remainingFlyers: number;
  notes?: string;
}) {
  const profile = await getDistributorProfileForUser(input.userId);
  const tour = await prisma.distributionTour.findFirst({
    where: { id: input.tourId, distributorId: profile.id },
    include: { inventory: true, gpsPoints: { orderBy: { recordedAt: "desc" }, take: 1 }, photoProofs: true },
  });
  if (!tour) throw new Error("Tour wurde nicht gefunden.");
  if (tour.status !== "STARTED" && tour.status !== "RESUMED" && tour.status !== "PAUSED") {
    throw new Error("Nur laufende Touren können abgeschlossen werden.");
  }
  const now = new Date();
  const totalDurationSeconds = tour.startTime
    ? Math.max(Math.floor((now.getTime() - tour.startTime.getTime()) / 1000) - tour.totalPauseSeconds, 0)
    : null;
  const lastPoint = tour.gpsPoints[0];
  const updated = await prisma.distributionTour.update({
    where: { id: tour.id },
    data: {
      status: "UNDER_REVIEW",
      endTime: now,
      completedAt: now,
      totalDurationSeconds,
      durationSeconds: totalDurationSeconds ?? undefined,
      actualDurationMinutes: totalDurationSeconds ? Math.round(totalDurationSeconds / 60) : undefined,
      remainingFlyers: input.remainingFlyers,
      distributorNotes: input.notes ?? null,
      ...(lastPoint ? { endLat: lastPoint.lat, endLng: lastPoint.lng } : {}),
      fraudFlags: {
        ...(typeof tour.fraudFlags === "object" && tour.fraudFlags ? tour.fraudFlags : {}),
        missingPhotos: tour.photoProofs.length === 0,
      },
    },
  });
  if (tour.inventoryId) {
    await prisma.warehouseInventory.update({
      where: { id: tour.inventoryId },
      data: {
        remainingFlyers: input.remainingFlyers,
        remainingStockStatus: input.remainingFlyers === 0 ? "ALLE_VERTEILT" : "RESTBESTAND",
      },
    });
  }
  await createAuditLog({ userId: input.userId, action: "tour.completed", entityType: "DistributionTour", entityId: tour.id });
  await notifyAdmins({ type: "TOUR_UNDER_REVIEW", title: "Tour wartet auf Prüfung", message: `Tour ${tour.id} wurde abgeschlossen.` });
  return updated;
}

async function loadTourForReview(tourId: string) {
  const tour = await prisma.distributionTour.findUnique({
    where: { id: tourId },
    include: {
      order: { include: { customer: true } },
      distributor: { include: { user: true } },
      gpsPoints: { orderBy: { recordedAt: "asc" } },
      photoProofs: true,
    },
  });
  if (!tour) throw new Error("Tour wurde nicht gefunden.");
  return tour;
}

export async function openTourReview(input: { tourId: string; adminUserId: string }) {
  const tour = await loadTourForReview(input.tourId);
  const analysis = analyzeRoute({
    points: tour.gpsPoints.map(normalizeRoutePoint),
    pauseSeconds: tour.totalPauseSeconds,
    targetAreaGeoJson: tour.order.targetAreaGeoJson,
  });
  await createAuditLog({
    userId: input.adminUserId,
    action: "tour.review_opened",
    entityType: "DistributionTour",
    entityId: tour.id,
    newValues: { flags: analysis.flags, pointCount: analysis.pointCount },
  });
  return { tour, analysis };
}

export async function approveTour(input: {
  tourId: string;
  adminUserId: string;
  note?: string;
  customerMessage?: string;
}) {
  const tour = await loadTourForReview(input.tourId);
  const analysis = analyzeRoute({
    points: tour.gpsPoints.map(normalizeRoutePoint),
    pauseSeconds: tour.totalPauseSeconds,
    targetAreaGeoJson: tour.order.targetAreaGeoJson,
  });
  const updated = await prisma.distributionTour.update({
    where: { id: tour.id },
    data: {
      status: "APPROVED",
      adminReviewStatus: "APPROVED",
      adminInternalNote: input.note ?? tour.adminInternalNote,
      adminCustomerMessage: input.customerMessage ?? tour.adminCustomerMessage,
      reviewedAt: new Date(),
      reviewedBy: input.adminUserId,
      totalDistanceMeters: analysis.distanceMeters,
      totalDurationSeconds: analysis.activeSeconds,
      actualDistanceKm: new Prisma.Decimal((analysis.distanceMeters / 1000).toFixed(2)),
      actualDurationMinutes: Math.round(analysis.activeSeconds / 60),
      gpsPointCount: tour.gpsPoints.length,
      gpsQualityScore: gpsQualityScore(analysis),
      actualRouteGeometry: routeLineString(tour.gpsPoints),
      fraudFlags: { routeAnalysis: analysis.flags },
    },
  });
  await prisma.order.update({
    where: { id: tour.orderId },
    data: { status: "REPORT_READY_PREVIEW" },
  });
  let report: Awaited<ReturnType<typeof prisma.report.upsert>> | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      report = await prisma.report.upsert({
        where: { tourId: tour.id },
        update: {
          status: "READY_FOR_REVIEW",
          internalReviewStatus: "IN_REVIEW",
          approvedById: input.adminUserId,
          approvedAt: new Date(),
          reviewedById: input.adminUserId,
          reviewedAt: new Date(),
          generatedAt: new Date(),
        },
        create: {
          orderId: tour.orderId,
          tourId: tour.id,
          customerId: tour.order.customerId,
          tenantId: tour.order.tenantId,
          reportNumber: await generateReportNumber(),
          status: "READY_FOR_REVIEW",
          reportType: "DISTRIBUTION_PROOF",
          template: "STANDARD",
          onlineUrl: "",
          internalReviewStatus: "IN_REVIEW",
          approvedById: input.adminUserId,
          approvedAt: new Date(),
          reviewedById: input.adminUserId,
          reviewedAt: new Date(),
          generatedAt: new Date(),
          verificationCode: `VRF-${tour.id.slice(-10).toUpperCase()}`,
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
  if (!report.onlineUrl) {
    await prisma.report.update({
      where: { id: report.id },
      data: { onlineUrl: generateOnlineReportUrl(report.id) },
    });
  }
  await createAuditLog({
    userId: input.adminUserId,
    action: "tour.approved",
    entityType: "DistributionTour",
    entityId: tour.id,
    newValues: { note: input.note, customerMessage: input.customerMessage, analysis },
  });
  await createNotification({
    userId: tour.order.customer.userId,
    type: "REPORT_PREVIEW_READY",
    title: "Berichtsvorschau verfügbar",
    message: `Die Verteilung für ${tour.order.orderNumber} wurde geprüft.`,
  });
  await createNotification({
    userId: tour.distributor.userId,
    type: "TOUR_APPROVED",
    title: "Tour freigegeben",
    message: `Tour ${tour.order.orderNumber} wurde freigegeben.`,
  });
  await notifyAdmins({
    type: "TOUR_REVIEW_COMPLETED",
    title: "Tourprüfung abgeschlossen",
    message: `Tour ${tour.order.orderNumber} wurde freigegeben.`,
  });
  return updated;
}

export async function rejectTour(input: {
  tourId: string;
  adminUserId: string;
  note?: string;
  customerMessage?: string;
}) {
  const tour = await loadTourForReview(input.tourId);
  const updated = await prisma.distributionTour.update({
    where: { id: tour.id },
    data: {
      status: "REJECTED",
      adminReviewStatus: "REJECTED",
      adminInternalNote: input.note ?? tour.adminInternalNote,
      adminCustomerMessage: input.customerMessage ?? tour.adminCustomerMessage,
      reviewedAt: new Date(),
      reviewedBy: input.adminUserId,
    },
  });
  await createAuditLog({
    userId: input.adminUserId,
    action: "tour.rejected",
    entityType: "DistributionTour",
    entityId: tour.id,
    newValues: { note: input.note, customerMessage: input.customerMessage },
  });
  await createNotification({
    userId: tour.distributor.userId,
    type: "TOUR_REJECTED",
    title: "Tour abgelehnt",
    message: `Tour ${tour.order.orderNumber} wurde abgelehnt.`,
  });
  if (input.customerMessage) {
    await createNotification({
      userId: tour.order.customer.userId,
      type: "TOUR_CUSTOMER_NOTE",
      title: "Hinweis zur Verteilung",
      message: input.customerMessage,
    });
  }
  return updated;
}

export async function clarifyTour(input: {
  tourId: string;
  adminUserId: string;
  note?: string;
  customerMessage?: string;
}) {
  const tour = await loadTourForReview(input.tourId);
  const updated = await prisma.distributionTour.update({
    where: { id: tour.id },
    data: {
      status: "NEEDS_CLARIFICATION",
      adminReviewStatus: "NEEDS_REVIEW",
      adminInternalNote: input.note ?? tour.adminInternalNote,
      adminCustomerMessage: input.customerMessage ?? tour.adminCustomerMessage,
      reviewedAt: new Date(),
      reviewedBy: input.adminUserId,
    },
  });
  await createAuditLog({
    userId: input.adminUserId,
    action: "tour.needs_clarification",
    entityType: "DistributionTour",
    entityId: tour.id,
    newValues: { note: input.note },
  });
  await createNotification({
    userId: tour.distributor.userId,
    type: "TOUR_NEEDS_CLARIFICATION",
    title: "Rueckfrage zur Tour",
    message: input.note || `Rueckfrage zu ${tour.order.orderNumber}.`,
  });
  return updated;
}

export async function saveTourAdminNote(input: {
  tourId: string;
  adminUserId: string;
  adminInternalNote?: string;
  adminCustomerMessage?: string;
}) {
  const updated = await prisma.distributionTour.update({
    where: { id: input.tourId },
    data: {
      adminInternalNote: input.adminInternalNote ?? null,
      adminCustomerMessage: input.adminCustomerMessage ?? null,
    },
  });
  await createAuditLog({
    userId: input.adminUserId,
    action: "tour.admin_note_added",
    entityType: "DistributionTour",
    entityId: input.tourId,
    newValues: {
      adminInternalNote: input.adminInternalNote,
      adminCustomerMessage: input.adminCustomerMessage,
    },
  });
  return updated;
}
