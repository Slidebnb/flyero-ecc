import { AutoDispatchRecommendationStatus, type DispatchAssignmentStatus, Prisma } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { asObject } from "@/lib/format";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { getSystemSettings } from "@/lib/settings";
import { warehouseSourceWhere } from "@/lib/warehouse";
import { productionOrderWhere, productionUserWhere } from "@/lib/productionData";
import { getOrderIntegrityCheck } from "@/lib/orderIntegrity";

const ACTIVE_ASSIGNMENT_STATUSES: DispatchAssignmentStatus[] = ["ASSIGNED", "ACCEPTED"];
const ACTIVE_TOUR_STATUSES = ["ASSIGNED", "READY", "PICKED_UP", "STARTED", "PAUSED", "RESUMED"] as const;
const COMPLETED_TOUR_STATUSES = ["COMPLETED", "UNDER_REVIEW", "APPROVED"] as const;

function orderTenantWhere(tenantId: string | null | undefined) {
  return { ...productionOrderWhere(), ...(tenantId === undefined ? {} : { tenantId: tenantId ?? "__no_tenant__" }) };
}

function orderRelationTenantWhere(tenantId: string | null | undefined) {
  return { order: { ...productionOrderWhere(), ...(tenantId === undefined ? {} : { tenantId: tenantId ?? "__no_tenant__" }) } };
}

function distributorTenantWhere(tenantId: string | null | undefined) {
  return { user: { ...productionUserWhere(), ...(tenantId === undefined ? {} : { tenantId: tenantId ?? "__no_tenant__" }) } };
}

async function ensureOrderAccess(orderId: string, tenantId: string | null | undefined) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, ...orderTenantWhere(tenantId) },
    select: { id: true },
  });
  if (!order) throw new Error("Auftrag wurde nicht gefunden oder ist nicht berechtigt.");
  return order;
}

type ReadyInventory = Prisma.WarehouseInventoryGetPayload<{
  include: {
    order: true;
    warehouseLocation: { include: { warehouse: true } };
  };
}>;

type DistributorWithUser = Prisma.DistributorProfileGetPayload<{
  include: { user: { select: { id: true, status: true, tenantId: true } } };
}>;

export type DistributorRecommendation = {
  distributorId: string;
  userId: string;
  name: string;
  city: string;
  distanceKm: number | null;
  distanceSource: "address-geodesic-estimate" | "unavailable";
  openTours: number;
  currentAssignedTours: number;
  currentAssignedFlyers: number;
  maxToursPerDay: number;
  maxFlyersPerDay: number;
  availableToday: boolean;
  capacityWarning: boolean;
  rating: number;
  completedTours: number;
  score: number;
  reasons: string[];
  warnings: string[];
};

function addressCity(address: unknown) {
  const value = asObject(address);
  return typeof value.city === "string" && value.city.trim() ? value.city.trim() : "";
}

function normalizeCity(city?: string | null) {
  return (city ?? "").trim().toLowerCase();
}

function addressCoordinates(address: unknown) {
  const value = asObject(address);
  const lat = Number(value.lat ?? value.latitude);
  const lng = Number(value.lng ?? value.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function haversineKm(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const earthKm = 6371;
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.max(0.1, Number((earthKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1)));
}

function targetCity(inventory: ReadyInventory) {
  return inventory.order.city || addressCity(inventory.order.targetAddress) || inventory.warehouseLocation?.warehouse.city || "";
}

async function syncDistributorCapacity(distributorId: string) {
  const [assignments, activeTours, completedTours] = await Promise.all([
    prisma.dispatchAssignment.findMany({
    where: { distributorId, status: { in: ACTIVE_ASSIGNMENT_STATUSES }, order: productionOrderWhere() },
      include: { order: true, segment: { select: { flyerQuantity: true } } },
    }),
    prisma.distributionTour.count({
      where: { distributorId, status: { in: [...ACTIVE_TOUR_STATUSES] }, order: productionOrderWhere() },
    }),
    prisma.distributionTour.count({
      where: { distributorId, status: { in: [...COMPLETED_TOUR_STATUSES] }, order: productionOrderWhere() },
    }),
  ]);

  const currentAssignedFlyers = assignments.reduce((sum, assignment) => sum + (assignment.segment?.flyerQuantity ?? assignment.order.flyerQuantity), 0);
  const currentAssignedTours = Math.max(activeTours, assignments.length);

  await prisma.distributorProfile.update({
    where: { id: distributorId },
    data: {
      currentAssignedFlyers,
      currentAssignedTours,
      completedToursCount: completedTours,
    },
  });

  return { currentAssignedFlyers, currentAssignedTours, completedTours };
}

async function distributorSnapshot(distributor: DistributorWithUser, inventory: ReadyInventory, flyerQuantityOverride?: number | null) {
  const capacity = await syncDistributorCapacity(distributor.id);
  const city = addressCity(distributor.address);
  const distributorCoordinates = addressCoordinates(distributor.address);
  const warehouseCoordinates = inventory.warehouseLocation?.warehouse.latitude && inventory.warehouseLocation?.warehouse.longitude
    ? { lat: Number(inventory.warehouseLocation.warehouse.latitude), lng: Number(inventory.warehouseLocation.warehouse.longitude) }
    : null;
  const distanceKm = distributorCoordinates && warehouseCoordinates
    ? haversineKm(distributorCoordinates, warehouseCoordinates)
    : null;
  const distanceSource = distributorCoordinates && warehouseCoordinates ? "address-geodesic-estimate" : "unavailable";
  const requestedFlyers = flyerQuantityOverride ?? inventory.order.flyerQuantity;
  const futureFlyers = capacity.currentAssignedFlyers + requestedFlyers;
  const futureTours = capacity.currentAssignedTours + 1;
  const rejectedAssignments = await prisma.dispatchAssignment.count({ where: { distributorId: distributor.id, status: "REJECTED", order: productionOrderWhere() } });
  const totalAssignments = await prisma.dispatchAssignment.count({ where: { distributorId: distributor.id, order: productionOrderWhere() } });
  const rejectionRate = totalAssignments > 0 ? rejectedAssignments / totalAssignments : 0;
  const capacityWarning =
    !distributor.availableToday ||
    futureFlyers > distributor.maxFlyersPerDay ||
    futureTours > distributor.maxToursPerDay;
  const preferredAreaMatch = distributor.preferredAreas.some(
    (area) => normalizeCity(area) === normalizeCity(targetCity(inventory)),
  );
  const reasons: string[] = ["Verteiler ist freigegeben"];
  const warnings: string[] = [];
  if (preferredAreaMatch) reasons.push("Einsatzgebiet passt");
  if (distributor.availableToday) reasons.push("Heute verfügbar");
  if (futureFlyers <= distributor.maxFlyersPerDay && futureTours <= distributor.maxToursPerDay) reasons.push("Kapazität frei");
  if (distanceKm !== null && distanceKm <= 10) reasons.push("Kurze Distanz zum Lager/Gebiet");
  if (capacity.completedTours > 0) reasons.push(`${capacity.completedTours} abgeschlossene Touren`);
  if (!preferredAreaMatch) warnings.push("Einsatzgebiet nicht exakt in bevorzugten Gebieten");
  if (!distributor.availableToday) warnings.push("Heute nicht verfügbar");
  if (futureFlyers > distributor.maxFlyersPerDay) warnings.push("Flyer-Kapazität überschritten");
  if (futureTours > distributor.maxToursPerDay) warnings.push("Tour-Kapazität überschritten");
  if (distanceKm === null) warnings.push("Entfernung nicht ermittelbar");
  else if (distanceKm > distributor.serviceRadiusKm) warnings.push("Ausserhalb Service-Radius");
  if (rejectionRate >= 0.35) warnings.push("Hohe Ablehnungsrate");
  if (capacity.currentAssignedTours > 0) warnings.push("Bereits offene Touren");

  const rawScore =
    35 +
    (preferredAreaMatch ? 20 : 0) +
    (distributor.availableToday ? 10 : -30) +
    (futureFlyers <= distributor.maxFlyersPerDay ? 10 : -20) +
    (futureTours <= distributor.maxToursPerDay ? 10 : -20) +
    (distanceKm === null ? 0 : Math.max(0, 15 - Math.round(distanceKm / 3))) +
    Math.min(10, capacity.completedTours * 2) +
    Math.round(Number(distributor.rating) * 2) -
    Math.round(rejectionRate * 25) -
    capacity.currentAssignedTours * 6;
  const score = Math.max(0, Math.min(100, rawScore));

  return {
    distributorId: distributor.id,
    userId: distributor.userId,
    name: `${distributor.firstName} ${distributor.lastName}`,
    city,
    distanceKm,
    distanceSource,
    openTours: capacity.currentAssignedTours,
    currentAssignedTours: capacity.currentAssignedTours,
    currentAssignedFlyers: capacity.currentAssignedFlyers,
    maxToursPerDay: distributor.maxToursPerDay,
    maxFlyersPerDay: distributor.maxFlyersPerDay,
    availableToday: distributor.availableToday,
    capacityWarning,
    rating: Number(distributor.rating),
    completedTours: Math.max(distributor.completedToursCount, capacity.completedTours),
    score,
    reasons,
    warnings,
  } satisfies DistributorRecommendation;
}

export async function getReadyInventoryForOrder(orderId: string, tenantId?: string | null) {
  return prisma.warehouseInventory.findFirst({
    where: { orderId, ...orderRelationTenantWhere(tenantId) },
    include: { order: true, warehouseLocation: { include: { warehouse: true } } },
  });
}

export async function getSuitableDistributors(orderId: string, tenantId?: string | null, segmentId?: string | null) {
  await ensureOrderAccess(orderId, tenantId);
  const inventory = await getReadyInventoryForOrder(orderId, tenantId);
  if (!inventory) {
    return [];
  }
  let segmentFlyerQuantity: number | null = null;
  if (segmentId) {
    const segment = await prisma.orderDistributionSegment.findFirst({ where: { id: segmentId, orderId }, select: { flyerQuantity: true } });
    if (!segment) throw new Error("Teilgebiet gehÃ¶rt nicht zu diesem Auftrag.");
    segmentFlyerQuantity = segment.flyerQuantity;
  }

  const distributors = await prisma.distributorProfile.findMany({
    where: {
      reviewStatus: "APPROVED",
      availableToday: true,
      user: { ...productionUserWhere(), status: "ACTIVE", ...(tenantId === undefined ? {} : { tenantId: tenantId ?? "__no_tenant__" }) },
    },
    include: { user: { select: { id: true, status: true, tenantId: true } } },
  });

  const recommendations = await Promise.all(
    distributors.map(async (distributor) => {
      const recommendation = await distributorSnapshot(distributor, inventory, segmentFlyerQuantity);
      const withinRadius = recommendation.distanceKm === null || recommendation.distanceKm <= distributor.serviceRadiusKm;
      const preferredAreaMatch = distributor.preferredAreas.some(
        (area) => normalizeCity(area) === normalizeCity(targetCity(inventory)),
      );
      return withinRadius || preferredAreaMatch ? recommendation : null;
    }),
  );

  return recommendations
    .filter((value): value is DistributorRecommendation => Boolean(value))
    .sort((a, b) => Number(a.capacityWarning) - Number(b.capacityWarning) || b.score - a.score || (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY));
}

export async function createAutoDispatchRecommendations(input: { orderId: string; adminUserId: string; tenantId?: string | null; segmentId?: string | null }) {
  await ensureOrderAccess(input.orderId, input.tenantId);
  const suitable = (await getSuitableDistributors(input.orderId, input.tenantId, input.segmentId)).slice(0, 5);
  await prisma.autoDispatchRecommendation.updateMany({
    where: { orderId: input.orderId, ...(input.segmentId ? { segmentId: input.segmentId } : {}), status: AutoDispatchRecommendationStatus.SUGGESTED },
    data: { status: AutoDispatchRecommendationStatus.EXPIRED },
  });

  const recommendations = [];
  for (const recommendation of suitable) {
    const existing = await prisma.autoDispatchRecommendation.findFirst({
      where: { orderId: input.orderId, distributorId: recommendation.distributorId, segmentId: input.segmentId ?? null },
      select: { id: true },
    });
    const created = existing
      ? await prisma.autoDispatchRecommendation.update({
          where: { id: existing.id },
          data: { score: recommendation.score, reasons: recommendation.reasons, warnings: recommendation.warnings, status: AutoDispatchRecommendationStatus.SUGGESTED },
          include: { distributor: { include: { user: { select: { id: true, status: true, tenantId: true } } } }, order: { select: { id: true, orderNumber: true, tenantId: true } } },
        })
      : await prisma.autoDispatchRecommendation.create({
          data: { orderId: input.orderId, distributorId: recommendation.distributorId, segmentId: input.segmentId ?? null, score: recommendation.score, reasons: recommendation.reasons, warnings: recommendation.warnings },
          include: { distributor: { include: { user: { select: { id: true, status: true, tenantId: true } } } }, order: { select: { id: true, orderNumber: true, tenantId: true } } },
        });
    recommendations.push(created);
  }

  await createAuditLog({
    userId: input.adminUserId,
    action: "dispatch.recommendation_created",
    entityType: "Order",
    entityId: input.orderId,
    newValues: { count: recommendations.length, scores: recommendations.map((item) => item.score) },
  });
  await notifyAdmins({
    type: "DISPATCH_RECOMMENDATIONS_CREATED",
    title: "Empfehlungen erstellt",
    message: `${recommendations.length} Auto-Dispatch-Empfehlungen wurden erstellt.`,
  });
  return recommendations;
}

export async function dismissAutoDispatchRecommendation(input: { recommendationId: string; adminUserId: string; tenantId?: string | null }) {
  const current = await prisma.autoDispatchRecommendation.findFirst({
    where: { id: input.recommendationId, ...orderRelationTenantWhere(input.tenantId) },
    select: { id: true },
  });
  if (!current) throw new Error("Empfehlung wurde nicht gefunden oder ist nicht berechtigt.");
  const updated = await prisma.autoDispatchRecommendation.update({
    where: { id: current.id },
    data: { status: AutoDispatchRecommendationStatus.DISMISSED },
  });
  await createAuditLog({
    userId: input.adminUserId,
    action: "dispatch.recommendation_dismissed",
    entityType: "AutoDispatchRecommendation",
    entityId: updated.id,
  });
  return updated;
}

export async function autoAssignRecommendedDistributor(input: { orderId: string; adminUserId: string; tenantId?: string | null; segmentId?: string | null }) {
  const system = await getSystemSettings();
  const recommendations = await createAutoDispatchRecommendations(input);
  const best = recommendations[0];
  if (!system.autoDispatchEnabled || !best || best.score < system.autoDispatchMinScore) {
    await createAuditLog({
      userId: input.adminUserId,
      action: "dispatch.auto_assign_skipped",
      entityType: "Order",
      entityId: input.orderId,
      newValues: { enabled: system.autoDispatchEnabled, minScore: system.autoDispatchMinScore, bestScore: best?.score ?? null },
    });
    await notifyAdmins({
      type: "DISPATCH_AUTO_ASSIGN_SKIPPED",
      title: "Auto-Dispatch übersprungen",
      message: `Auto-Dispatch für Auftrag wurde übersprungen. Mindestscore: ${system.autoDispatchMinScore}.`,
    });
    return { assigned: false, recommendation: best ?? null };
  }

  const assignment = await assignOrderToDistributor({
    orderId: input.orderId,
    distributorId: best.distributorId,
    adminUserId: input.adminUserId,
    tenantId: input.tenantId,
    segmentId: input.segmentId,
  });
  await prisma.autoDispatchRecommendation.update({
    where: { id: best.id },
    data: { status: AutoDispatchRecommendationStatus.SELECTED },
  });
  await createAuditLog({
    userId: input.adminUserId,
    action: "dispatch.recommendation_selected",
    entityType: "AutoDispatchRecommendation",
    entityId: best.id,
  });
  await createAuditLog({
    userId: input.adminUserId,
    action: "dispatch.auto_assigned",
    entityType: "DispatchAssignment",
    entityId: assignment.id,
    newValues: { orderId: input.orderId, distributorId: best.distributorId, score: best.score },
  });
  await notifyAdmins({
    type: "DISPATCH_AUTO_ASSIGNED",
    title: "Auto-Dispatch zugewiesen",
    message: `Auftrag wurde automatisch mit Score ${best.score} zugewiesen.`,
  });
  const distributor = await prisma.distributorProfile.findUnique({ where: { id: best.distributorId } });
  if (distributor) {
    await createNotification({
      userId: distributor.userId,
      type: "DISPATCH_AUTO_ASSIGNED_ORDER",
      title: "Neuer Auftrag durch Auto-Dispatch",
      message: "Ein neuer Auftrag wurde dir automatisch vorgeschlagen und zugewiesen.",
    });
  }
  return { assigned: true, recommendation: best, assignment };
}

export async function assignOrderToDistributor(input: {
  orderId: string;
  distributorId: string;
  adminUserId: string;
  tenantId?: string | null;
  segmentId?: string | null;
}) {
  await ensureOrderAccess(input.orderId, input.tenantId);
  const inventory = await getReadyInventoryForOrder(input.orderId, input.tenantId);
  if (!inventory) throw new Error("Auftrag hat keinen Lagerbestand.");
  if (inventory.status !== "READY_FOR_PICKUP") {
    throw new Error("Nur abholbereite Aufträge können disponiert werden.");
  }
  if (inventory.pickupStatus !== "PREPARED" && inventory.pickupStatus !== "RESERVED") {
    throw new Error("Der Lagerbestand muss vorbereitet sein, bevor er disponiert wird.");
  }
  const integrity = await getOrderIntegrityCheck(input.orderId);
  if (!integrity.quoteMatchesOrder || !integrity.pricingMatchesSnapshot || !integrity.flyerQuantityConsistent || !integrity.polygonReferenceMatches) {
    const error = new Error("ORDER_INTEGRITY_FAILED");
    (error as Error & { code?: string }).code = "ORDER_INTEGRITY_FAILED";
    throw error;
  }

  const distributor = await prisma.distributorProfile.findFirst({
    where: { id: input.distributorId, ...distributorTenantWhere(input.tenantId) },
    include: { user: { select: { id: true, status: true, tenantId: true } } },
  });
  if (!distributor || distributor.reviewStatus !== "APPROVED" || distributor.user.status !== "ACTIVE") {
    throw new Error("Verteiler ist nicht freigegeben oder nicht aktiv.");
  }

  const segmentCount = await prisma.orderDistributionSegment.count({ where: { orderId: input.orderId } });
  const isMultiSegmentOrder = segmentCount > 1;
  if (isMultiSegmentOrder && !input.segmentId) {
    throw new Error("MehrgebietsauftrÃ¤ge benÃ¶tigen ein ausgewÃ¤hltes Teilgebiet.");
  }
  const segment = input.segmentId
    ? await prisma.orderDistributionSegment.findFirst({ where: { id: input.segmentId, orderId: input.orderId }, select: { flyerQuantity: true } })
    : null;
  if (input.segmentId && !segment) throw new Error("Teilgebiet gehÃ¶rt nicht zu diesem Auftrag.");
  const segmentAwareRecommendation = await distributorSnapshot(distributor, inventory, segment?.flyerQuantity);
  const previousActive = await prisma.dispatchAssignment.findMany({
    where: {
      orderId: input.orderId,
      ...(input.segmentId ? { segmentId: input.segmentId } : {}),
      status: { in: ACTIVE_ASSIGNMENT_STATUSES },
    },
  });
  const isReassignment = previousActive.some((assignment) => assignment.distributorId !== input.distributorId);

  const [assignment, tour] = await prisma.$transaction(async (tx) => {
    if (input.segmentId) {
      const segment = await tx.orderDistributionSegment.findFirst({
        where: { id: input.segmentId, orderId: input.orderId },
        select: { id: true },
      });
      if (!segment) throw new Error("Teilgebiet gehört nicht zu diesem Auftrag.");
    }
    if (previousActive.length > 0) {
      await tx.dispatchAssignment.updateMany({
        where: { id: { in: previousActive.map((assignment) => assignment.id) } },
        data: { status: isReassignment ? "REASSIGNED" : "CANCELLED", cancelledAt: new Date() },
      });
    }

    await tx.distributionTour.updateMany({
      where: {
        orderId: input.orderId,
        ...(input.segmentId ? { segmentId: input.segmentId } : {}),
        status: { in: [...ACTIVE_TOUR_STATUSES] },
      },
      data: { status: "CANCELLED" },
    });

    const nextAssignment = await tx.dispatchAssignment.create({
      data: {
        orderId: input.orderId,
        segmentId: input.segmentId ?? null,
        inventoryId: inventory.id,
        distributorId: input.distributorId,
        assignedBy: input.adminUserId,
        capacityWarning: segmentAwareRecommendation.capacityWarning,
        recommendationScore: segmentAwareRecommendation.score,
        distanceMeters: segmentAwareRecommendation.distanceKm === null ? null : Math.round(segmentAwareRecommendation.distanceKm * 1000),
      },
    });

    const nextTour = await tx.distributionTour.create({
      data: {
        orderId: input.orderId,
        inventoryId: inventory.id,
        distributorId: input.distributorId,
        segmentId: input.segmentId ?? null,
        status: "ASSIGNED",
      },
    });

    await tx.order.update({
      where: { id: input.orderId },
      data: { assignedDistributorId: isMultiSegmentOrder ? null : input.distributorId },
    });

    await tx.warehouseInventory.update({
      where: { id: inventory.id },
      data: {
        reservedDistributorId: isMultiSegmentOrder ? null : input.distributorId,
        pickupStatus: "RESERVED",
      },
    });

    return [nextAssignment, nextTour] as const;
  });

  await syncDistributorCapacity(input.distributorId);
  await createAuditLog({
    userId: input.adminUserId,
    action: isReassignment ? "dispatch.reassigned" : "dispatch.assigned",
    entityType: "DispatchAssignment",
    entityId: assignment.id,
    newValues: {
      orderId: input.orderId,
      distributorId: input.distributorId,
      inventoryId: inventory.id,
      tourId: tour.id,
      capacityWarning: segmentAwareRecommendation.capacityWarning,
      distanceMeters: assignment.distanceMeters,
      distanceSource: segmentAwareRecommendation.distanceSource,
    },
  });

  await createNotification({
    userId: distributor.userId,
    type: "DISPATCH_NEW_ORDER",
    title: "Neuer Auftrag",
    message: `Auftrag ${inventory.order.orderNumber} wartet auf deine Annahme.`,
    data: {
      orderNumber: inventory.order.orderNumber,
      flyerQuantity: segment?.flyerQuantity ?? inventory.order.flyerQuantity,
      areaName: inventory.order.targetAreaName,
      city: inventory.order.city,
      postalCode: inventory.order.postalCode,
      nextStep: "Bitte pruefe den Auftrag im Verteilerbereich.",
    },
  });

  if (segmentAwareRecommendation.capacityWarning) {
    await notifyAdmins({
      type: "DISPATCH_CAPACITY_EXCEEDED",
      title: "Kapazität überschritten",
      message: `${distributor.firstName} ${distributor.lastName}: Auftrag ${inventory.order.orderNumber} überschreitet die hinterlegte Kapazität.`,
    });
  }

  return assignment;
}

export async function acceptDispatchOrder(input: { orderId: string; distributorUserId: string; assignmentId?: string }) {
  const profile = await prisma.distributorProfile.findUnique({ where: { userId: input.distributorUserId } });
  if (!profile || profile.reviewStatus !== "APPROVED") {
    throw new Error("Verteilerprofil ist nicht freigegeben.");
  }

  const assignment = await prisma.dispatchAssignment.findFirst({
    where: {
      ...(input.assignmentId ? { id: input.assignmentId } : {}),
      orderId: input.orderId,
      distributorId: profile.id,
      status: { in: ["ASSIGNED", "ACCEPTED"] },
    },
    include: { order: true, inventory: true },
  });
  if (!assignment) {
    throw new Error("Keine offene Dispatch-Anfrage gefunden.");
  }
  if (assignment.status === "ACCEPTED") return assignment;
  const segmentCount = await prisma.orderDistributionSegment.count({ where: { orderId: input.orderId } });
  const isMultiSegmentOrder = segmentCount > 1;
  if (!isMultiSegmentOrder && assignment.inventory?.reservedDistributorId && assignment.inventory.reservedDistributorId !== profile.id) {
    throw new Error("Dieser Auftrag ist bereits für einen anderen Verteiler reserviert.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const accepted = await tx.dispatchAssignment.update({
      where: { id: assignment.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
    if (assignment.inventoryId && !isMultiSegmentOrder) {
      await tx.warehouseInventory.update({
        where: { id: assignment.inventoryId },
        data: { reservedDistributorId: profile.id, pickupStatus: "RESERVED" },
      });
    }
    await tx.distributionTour.updateMany({
      where: {
        orderId: input.orderId,
        distributorId: profile.id,
        ...(assignment.segmentId ? { segmentId: assignment.segmentId } : {}),
        status: "ASSIGNED",
      },
      data: { status: "READY" },
    });
    await tx.order.update({
      where: { id: input.orderId },
      data: { assignedDistributorId: isMultiSegmentOrder ? null : profile.id },
    });
    return accepted;
  });

  await syncDistributorCapacity(profile.id);
  await createAuditLog({
    userId: input.distributorUserId,
    action: "dispatch.accepted",
    entityType: "DispatchAssignment",
    entityId: assignment.id,
    newValues: { orderId: input.orderId, distributorId: profile.id },
  });
  await notifyAdmins({
    type: "DISPATCH_ACCEPTED",
    title: "Auftrag angenommen",
    message: `${profile.firstName} ${profile.lastName} hat ${assignment.order.orderNumber} angenommen.`,
  });

  return updated;
}

export async function rejectDispatchOrder(input: {
  orderId: string;
  distributorUserId: string;
  assignmentId?: string;
  reason: "KEINE_ZEIT" | "KRANK" | "ZU_WEIT" | "SONSTIGES";
  note?: string;
}) {
  const profile = await prisma.distributorProfile.findUnique({ where: { userId: input.distributorUserId } });
  if (!profile || profile.reviewStatus !== "APPROVED") {
    throw new Error("Verteilerprofil ist nicht freigegeben.");
  }

  const assignment = await prisma.dispatchAssignment.findFirst({
    where: {
      ...(input.assignmentId ? { id: input.assignmentId } : {}),
      orderId: input.orderId,
      distributorId: profile.id,
      status: { in: ["ASSIGNED", "REJECTED"] },
    },
    include: { order: true },
  });
  if (!assignment) {
    throw new Error("Keine offene Dispatch-Anfrage gefunden.");
  }
  if (assignment.status === "REJECTED") return assignment;
  const segmentCount = await prisma.orderDistributionSegment.count({ where: { orderId: input.orderId } });
  const isMultiSegmentOrder = segmentCount > 1;

  const updated = await prisma.$transaction(async (tx) => {
    const rejected = await tx.dispatchAssignment.update({
      where: { id: assignment.id },
      data: {
        status: "REJECTED",
        rejectedAt: new Date(),
        rejectionReason: input.reason,
        rejectionNote: input.note ?? null,
      },
    });
    await tx.order.update({
      where: { id: input.orderId },
      data: { assignedDistributorId: null },
    });
    if (assignment.inventoryId && !isMultiSegmentOrder) {
      await tx.warehouseInventory.update({
        where: { id: assignment.inventoryId },
        data: { reservedDistributorId: null, pickupStatus: "PREPARED" },
      });
    }
    await tx.distributionTour.updateMany({
      where: {
        orderId: input.orderId,
        distributorId: profile.id,
        ...(assignment.segmentId ? { segmentId: assignment.segmentId } : {}),
        status: { in: ["ASSIGNED", "READY"] },
      },
      data: { status: "CANCELLED" },
    });
    return rejected;
  });

  await syncDistributorCapacity(profile.id);
  await createAuditLog({
    userId: input.distributorUserId,
    action: "dispatch.rejected",
    entityType: "DispatchAssignment",
    entityId: assignment.id,
    oldValues: { status: "ASSIGNED" },
    newValues: { status: "REJECTED", reason: input.reason, note: input.note ?? null },
  });
  await createAuditLog({
    userId: input.distributorUserId,
    action: "dispatch.unassigned",
    entityType: "Order",
    entityId: input.orderId,
    oldValues: { distributorId: profile.id },
    newValues: { distributorId: null, reason: input.reason },
  });
  await notifyAdmins({
    type: "DISPATCH_REJECTED",
    title: "Auftrag abgelehnt",
    message: `${profile.firstName} ${profile.lastName} hat ${assignment.order.orderNumber} abgelehnt.`,
  });

  return updated;
}

export async function getDispatchDashboard(filters: {
  city?: string;
  distributorId?: string;
  status?: string;
  date?: string;
  warehouseId?: string;
}, tenantId?: string | null) {
  const start = filters.date ? new Date(`${filters.date}T00:00:00`) : new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const inventoryWhere: Prisma.WarehouseInventoryWhereInput = {
    status: "READY_FOR_PICKUP",
    pickupStatus: { in: ["PREPARED", "RESERVED"] },
    ...(filters.warehouseId ? { warehouseLocation: { warehouseId: filters.warehouseId } } : {}),
    order: { ...productionOrderWhere(), ...(tenantId === undefined ? {} : { tenantId: tenantId ?? "__no_tenant__" }), ...(filters.city ? { city: { contains: filters.city, mode: "insensitive" } } : {}) },
  };

  const assignmentWhere: Prisma.DispatchAssignmentWhereInput = {
    ...(filters.distributorId ? { distributorId: filters.distributorId } : {}),
    ...(filters.status ? { status: filters.status as DispatchAssignmentStatus } : {}),
    order: { ...productionOrderWhere(), ...(tenantId === undefined ? {} : { tenantId: tenantId ?? "__no_tenant__" }), ...(filters.city ? { city: { contains: filters.city, mode: "insensitive" } } : {}) },
    ...(filters.warehouseId ? { inventory: { warehouseLocation: { warehouseId: filters.warehouseId } } } : {}),
  };

  const [inventories, assignments, runningTours, completedTours, warehouses, distributors, openOrders, reserved, readyForPickup, plannedToday, completedToday] =
    await Promise.all([
      prisma.warehouseInventory.findMany({
        where: inventoryWhere,
        include: {
          order: {
            include: {
              customer: true,
              distributionSegments: { orderBy: { sortOrder: "asc" } },
              dispatchAssignments: { where: { status: { in: ACTIVE_ASSIGNMENT_STATUSES } } },
            },
          },
          warehouseLocation: { include: { warehouse: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.dispatchAssignment.findMany({
        where: assignmentWhere,
        include: {
          order: { include: { customer: true } },
          distributor: true,
          inventory: { include: { warehouseLocation: { include: { warehouse: true } } } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.distributionTour.findMany({
        where: { status: { in: ["STARTED", "PAUSED", "RESUMED"] }, ...orderRelationTenantWhere(tenantId) },
        include: { order: true, distributor: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.distributionTour.findMany({
        where: { status: { in: [...COMPLETED_TOUR_STATUSES] }, ...orderRelationTenantWhere(tenantId) },
        include: { order: true, distributor: true },
        orderBy: { updatedAt: "desc" },
        take: 25,
      }),
      prisma.warehouse.findMany({ where: warehouseSourceWhere(), orderBy: { name: "asc" } }),
      prisma.distributorProfile.findMany({ where: { ...distributorTenantWhere(tenantId), reviewStatus: "APPROVED" }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
      prisma.order.count({ where: { ...orderTenantWhere(tenantId), status: { in: ["APPROVED", "READY_FOR_FLYERS", "FLYERS_EXPECTED", "FLYERS_RECEIVED", "STORED", "READY_FOR_PICKUP"] } } }),
      prisma.dispatchAssignment.count({ where: { status: "ACCEPTED", ...orderRelationTenantWhere(tenantId) } }),
      prisma.warehouseInventory.count({ where: { status: "READY_FOR_PICKUP", ...orderRelationTenantWhere(tenantId) } }),
      prisma.distributionTour.count({ where: { status: { in: ["ASSIGNED", "READY", "PICKED_UP", "STARTED", "PAUSED", "RESUMED"] }, createdAt: { gte: start, lt: end }, ...orderRelationTenantWhere(tenantId) } }),
      prisma.distributionTour.count({ where: { status: { in: [...COMPLETED_TOUR_STATUSES] }, completedAt: { gte: start, lt: end }, ...orderRelationTenantWhere(tenantId) } }),
    ]);

  const unassignedInventories = inventories.filter(
    (inventory) => inventory.order.dispatchAssignments.length === 0 && !inventory.reservedDistributorId,
  );

  const recommendationsByOrderId: Record<string, DistributorRecommendation[]> = {};
  const persistedRecommendations = await prisma.autoDispatchRecommendation.findMany({
    where: { orderId: { in: unassignedInventories.map((inventory) => inventory.orderId) }, status: "SUGGESTED" },
    include: { distributor: true, segment: { select: { id: true, name: true, city: true, postalCode: true, flyerQuantity: true } } },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
  });
  for (const inventory of unassignedInventories) {
    if (inventory.order.distributionSegments.length > 1) {
      for (const segment of inventory.order.distributionSegments) {
        recommendationsByOrderId[`${inventory.orderId}:${segment.id}`] = await getSuitableDistributors(inventory.orderId, tenantId, segment.id);
      }
    } else {
      recommendationsByOrderId[inventory.orderId] = await getSuitableDistributors(inventory.orderId, tenantId, inventory.order.distributionSegments[0]?.id ?? null);
    }
  }

  return {
    metrics: {
      openOrders,
      unassigned: unassignedInventories.length,
      reserved,
      readyForPickup,
      plannedToday,
      completedToday,
    },
    unassignedInventories,
    assignments,
    runningTours,
    completedTours,
    warehouses,
    distributors,
    recommendationsByOrderId,
    persistedRecommendations,
  };
}
