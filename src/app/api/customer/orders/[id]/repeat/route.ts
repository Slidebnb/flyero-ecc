import { requireTenantSession } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { errorResponse, routeErrorResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await requireTenantSession();
    const { id } = await context.params;
    const order = await prisma.order.findFirst({
      where: { id, tenantId: session.tenantId, customer: { userId: session.id, tenantId: session.tenantId } },
      select: {
        city: true,
        postalCode: true,
        targetAddress: true,
        targetLat: true,
        targetLng: true,
        targetAreaName: true,
        targetAreaGeoJson: true,
      flyerQuantity: true,
        serviceType: true,
        weightInGrams: true,
        productDetails: true,
        customerOwnFlyers: true,
        needsPrintService: true,
        assignedWarehouseId: true,
        preferredStartDate: true,
        preferredEndDate: true,
        flexibleScheduling: true,
        contactPerson: true,
        contactPhone: true,
        notes: true,
        distributionSegments: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    if (!order) return errorResponse("Kampagne wurde nicht gefunden.", 404);
    const address = order.targetAddress && typeof order.targetAddress === "object" ? order.targetAddress as Record<string, unknown> : {};
    return Response.json({
      ok: true,
      data: {
        draft: {
          query: `${order.postalCode} ${order.city}`,
          city: order.city,
          postalCode: order.postalCode,
          street: typeof address.street === "string" ? address.street : "",
          houseNumber: typeof address.houseNumber === "string" ? address.houseNumber : "",
          targetAreaName: order.targetAreaName,
          center: order.targetLat && order.targetLng ? { lat: Number(order.targetLat), lng: Number(order.targetLng) } : null,
          targetAreaGeoJson: order.targetAreaGeoJson,
          areaSegments: order.distributionSegments.map((segment) => ({
            name: segment.name,
            city: segment.city,
            postalCode: segment.postalCode,
            district: segment.district,
            country: segment.country,
            geometryGeoJson: segment.geometryGeoJson,
            distributionAreaId: segment.distributionAreaId,
            centerLat: segment.centerLat ? Number(segment.centerLat) : null,
            centerLng: segment.centerLng ? Number(segment.centerLng) : null,
            flyerQuantity: segment.flyerQuantity,
            notes: segment.notes,
          })),
          flyerQuantity: order.flyerQuantity,
          serviceType: order.serviceType,
          weightInGrams: order.weightInGrams ?? undefined,
          productDetails: order.productDetails && typeof order.productDetails === "object" && !Array.isArray(order.productDetails) ? order.productDetails as Record<string, unknown> : undefined,
          flyerQuantityTouched: true,
          flyerSource: "CUSTOMER_OWN",
          warehouseId: order.assignedWarehouseId,
          printDataStatus: "UPLOAD_LATER",
          startDate: order.preferredStartDate.toISOString().slice(0, 10),
          endDate: order.preferredEndDate.toISOString().slice(0, 10),
          flexibleScheduling: order.flexibleScheduling,
          contactPerson: order.contactPerson ?? "",
          contactPhone: order.contactPhone ?? "",
          notes: order.notes ?? "",
        },
      },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
