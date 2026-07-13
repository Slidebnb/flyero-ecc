import type { Prisma } from "@prisma/client";

/**
 * The distributor workflow needs operational order data, never customer data.
 * Keep this allowlist deliberately small so new Order fields are not exposed
 * accidentally through distributor API responses or server-rendered pages.
 */
export const distributorOrderSelect = {
  id: true,
  orderNumber: true,
  status: true,
  city: true,
  postalCode: true,
  targetAreaName: true,
  targetAreaGeoJson: true,
  flyerQuantity: true,
  estimatedHouseholds: true,
  preferredStartDate: true,
  preferredEndDate: true,
  customerOwnFlyers: true,
  needsPrintService: true,
} satisfies Prisma.OrderSelect;

export const distributorInventorySelect = {
  id: true,
  status: true,
  qrCode: true,
  cartonCount: true,
  expectedFlyers: true,
  remainingFlyers: true,
  pickupStatus: true,
  warehouseLocation: {
    select: {
      id: true,
      fullLabel: true,
      warehouse: {
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          postalCode: true,
          country: true,
        },
      },
    },
  },
} satisfies Prisma.WarehouseInventorySelect;
