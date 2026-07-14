import type { Prisma } from "@prisma/client";

/**
 * Production must never present the records created by the isolated demo seed.
 * Development and smoke-test databases keep their fixtures so existing checks
 * remain useful.
 */
export const isProductionRuntime = process.env.NODE_ENV === "production";

export function productionOrderWhere(): Prisma.OrderWhereInput {
  if (!isProductionRuntime) return {};
  return {
    NOT: [
      { orderNumber: { startsWith: "DEMO-" } },
      { notes: { contains: "Seed" } },
    ],
  };
}

export function productionUserWhere(): Prisma.UserWhereInput {
  if (!isProductionRuntime) return {};
  return { NOT: [{ email: { endsWith: "@example.com" } }] };
}

export function productionCustomerWhere(): Prisma.CustomerProfileWhereInput {
  if (!isProductionRuntime) return {};
  return { user: productionUserWhere() };
}

export function productionDistributorWhere(): Prisma.DistributorProfileWhereInput {
  if (!isProductionRuntime) return {};
  return { user: productionUserWhere() };
}

export function productionLeadWhere(): Prisma.LeadWhereInput {
  if (!isProductionRuntime) return {};
  return {
    NOT: [
      { source: { startsWith: "seed" } },
      { email: { endsWith: "@example.com" } },
    ],
  };
}

export function productionAreaWhere(): Prisma.DistributionAreaWhereInput {
  if (!isProductionRuntime) return {};
  return { NOT: [{ dataSourceType: "SEED" }] };
}

export function productionDocumentWhere(): Prisma.DocumentWhereInput {
  if (!isProductionRuntime) return {};
  return {
    NOT: [
      { storedFilename: { startsWith: "seed/" } },
      { title: { startsWith: "Seed Modul" } },
    ],
  };
}

export function productionPrintPartnerWhere(): Prisma.PrintPartnerWhereInput {
  if (!isProductionRuntime) return {};
  return {
    NOT: [
      { email: { endsWith: "@example.com" } },
      { email: { contains: "print-seed-" } },
    ],
  };
}

export function productionPrintOrderWhere(): Prisma.PrintOrderWhereInput {
  if (!isProductionRuntime) return {};
  return {
    NOT: [{ notes: { startsWith: "seed." } }],
    order: productionOrderWhere(),
  };
}

export function productionInvoiceWhere(): Prisma.InvoiceWhereInput {
  if (!isProductionRuntime) return {};
  return { order: productionOrderWhere() };
}

export function productionPaymentWhere(): Prisma.PaymentWhereInput {
  if (!isProductionRuntime) return {};
  return { order: productionOrderWhere() };
}

export function productionReportWhere(): Prisma.ReportWhereInput {
  if (!isProductionRuntime) return {};
  return { order: productionOrderWhere() };
}

export function productionInventoryWhere(): Prisma.WarehouseInventoryWhereInput {
  if (!isProductionRuntime) return {};
  return { order: productionOrderWhere() };
}

export function productionTourWhere(): Prisma.DistributionTourWhereInput {
  if (!isProductionRuntime) return {};
  return { order: productionOrderWhere() };
}

export function productionOrderExperienceEventWhere(): Prisma.OrderExperienceEventWhereInput {
  if (!isProductionRuntime) return {};
  return {
    NOT: [
      { source: { startsWith: "seed." } },
      { metadata: { path: ["source"], equals: "seed.module24" } },
    ],
  };
}

export function productionPaymentEventWhere(): Prisma.PaymentEventWhereInput {
  if (!isProductionRuntime) return {};
  return {
    NOT: [
      { stripeEventId: { startsWith: "evt_seed_" } },
      { payload: { path: ["seed"], equals: true } },
    ],
  };
}

export function productionAccountingExportWhere(): Prisma.AccountingExportWhereInput {
  if (!isProductionRuntime) return {};
  return { NOT: [{ exportNumber: { startsWith: "ACC-SEED-" } }] };
}

export function productionAuditLogWhere(): Prisma.AuditLogWhereInput {
  if (!isProductionRuntime) return {};
  return {
    NOT: [
      { action: { startsWith: "seed." } },
      { entityId: { startsWith: "seed" } },
      { newValues: { path: ["seed"], equals: true } },
    ],
  };
}

export function productionErrorLogWhere(): Prisma.ErrorLogWhereInput {
  if (!isProductionRuntime) return {};
  return {
    NOT: [
      { source: { startsWith: "seed." } },
      { message: { startsWith: "Seed" } },
    ],
  };
}

export function productionNotificationMessageWhere(): Prisma.NotificationMessageWhereInput {
  if (!isProductionRuntime) return {};
  return {
    NOT: [
      { subject: { contains: "Seed", mode: "insensitive" } },
      { body: { contains: "Seed", mode: "insensitive" } },
      { subject: { contains: "M15-", mode: "insensitive" } },
      { body: { contains: "M15-", mode: "insensitive" } },
      { data: { path: ["source"], equals: "seed.module18" } },
      { data: { path: ["companyName"], equals: "Flyero Demo" } },
    ],
  };
}

export function productionNotificationQueueWhere(): Prisma.NotificationQueueWhereInput {
  if (!isProductionRuntime) return {};
  return {
    user: productionUserWhere(),
    message: productionNotificationMessageWhere(),
  };
}

export function productionNotificationLogWhere(): Prisma.NotificationLogWhereInput {
  if (!isProductionRuntime) return {};
  return {
    user: productionUserWhere(),
    NOT: [
      { detail: { contains: "Seed", mode: "insensitive" } },
      { action: { startsWith: "seed." } },
      { metadata: { path: ["source"], equals: "seed.module18" } },
    ],
  };
}

export function productionSupportTicketWhere(): Prisma.SupportTicketWhereInput {
  if (!isProductionRuntime) return {};
  return {
    order: productionOrderWhere(),
    NOT: [
      { subject: { contains: "Seed", mode: "insensitive" } },
      { description: { contains: "Seed", mode: "insensitive" } },
      { createdBy: { email: { endsWith: "@example.com" } } },
    ],
  };
}
