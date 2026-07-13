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
        customerOwnFlyers: true,
        needsPrintService: true,
        preferredStartDate: true,
        preferredEndDate: true,
        flexibleScheduling: true,
        contactPerson: true,
        contactPhone: true,
        notes: true,
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
          flyerQuantity: order.flyerQuantity,
          flyerQuantityTouched: true,
          flyerSource: order.customerOwnFlyers ? "CUSTOMER_OWN" : "PRINT_SERVICE",
          printDataStatus: order.needsPrintService ? "PRINT_REQUESTED" : "UPLOAD_LATER",
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
