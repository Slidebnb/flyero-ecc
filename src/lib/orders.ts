import { OrderStatus, Prisma, ServiceType } from "@prisma/client";
import { isValidOrderTransition } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { generateSettingsNumber } from "@/lib/settings";

export async function generateOrderNumber() {
  return generateSettingsNumber("order");
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus) {
  if (from === to) {
    return;
  }

  if (!isValidOrderTransition(from, to)) {
    const error = new Error(`Ungueltiger Statuswechsel von ${from} zu ${to}.`) as Error & { code?: string };
    error.code = "INVALID_ORDER_TRANSITION";
    throw error;
  }
}

export async function createOrderStatusEvent(input: {
  orderId: string;
  fromStatus?: OrderStatus | null;
  toStatus: OrderStatus;
  changedBy?: string | null;
  note?: string | null;
}) {
  await prisma.orderStatusEvent.create({
    data: {
      orderId: input.orderId,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus,
      changedBy: input.changedBy ?? null,
      note: input.note ?? null,
    },
  });
}

export function decimalToNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value == null) return null;
  return Number(value);
}

export function normalizeServiceType(value: string): ServiceType {
  if (value === "FLYER_DISTRIBUTION") return "FLYER_DISTRIBUTION";
  if (value === "DOOR_HANGER") return "DOOR_HANGER";
  if (value === "BROCHURE") return "BROCHURE";
  if (value === "MAGAZINE") return "MAGAZINE";
  return "FLYER_DISTRIBUTION";
}
