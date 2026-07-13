import type { Prisma } from "@prisma/client";

/**
 * Lagerrollen brauchen die operative Auftragsreferenz, aber keine Kundendaten.
 * Die Auswahl bleibt bewusst klein, damit neue Order-Felder nicht automatisch
 * in Lagerantworten oder Server-Rendered-Seiten gelangen.
 */
export const warehouseOrderSelect = {
  id: true,
  orderNumber: true,
  status: true,
  city: true,
  postalCode: true,
  targetAreaName: true,
  flyerQuantity: true,
} satisfies Prisma.OrderSelect;

export const warehouseLocationSelect = {
  id: true,
  fullLabel: true,
  warehouse: {
    select: {
      id: true,
      name: true,
      city: true,
      postalCode: true,
      country: true,
    },
  },
} satisfies Prisma.WarehouseLocationSelect;

export const warehouseSelect = {
  id: true,
  name: true,
  city: true,
  postalCode: true,
  country: true,
} satisfies Prisma.WarehouseSelect;
