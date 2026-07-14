import { Prisma, UserRole, UserStatus } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { notifyAdmins } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { productionUserWhere } from "@/lib/productionData";

const CURRENT_YEAR = new Date().getFullYear();

export const PRICING_SETTING_KEYS = {
  vatRate: "vat_rate",
  expressSurcharge: "express_surcharge",
  photoProofSurcharge: "photo_proof_surcharge",
  warehouseSurcharge: "warehouse_surcharge",
} as const;

export async function getCompanySettings() {
  const existing = await prisma.companySettings.findFirst({
    where: process.env.NODE_ENV === "production"
      ? { NOT: { OR: [{ street: "Musterstrasse 1" }, { bankName: "Demo Bank" }, { vatId: "DE000000000" }] } }
      : undefined,
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;
  return prisma.companySettings.create({
    data: {
      companyName: "",
      legalName: "",
      street: "",
      postalCode: "",
      city: "",
      country: "DE",
      phone: "",
      email: "",
      website: "",
      taxNumber: "",
      vatId: "",
      bankName: "",
      iban: "",
      bic: "",
    },
  });
}

export async function updateCompanySettings(data: Prisma.CompanySettingsUpdateInput, userId?: string | null) {
  const current = await getCompanySettings();
  const updated = await prisma.companySettings.update({ where: { id: current.id }, data });
  await createAuditLog({
    userId,
    action: "settings.company_updated",
    entityType: "CompanySettings",
    entityId: updated.id,
    oldValues: current,
    newValues: updated,
  });
  await notifyAdmins({ type: "SETTINGS_CHANGED", title: "Einstellungen geändert", message: "Firmeneinstellungen wurden aktualisiert." });
  return updated;
}

export async function getBrandingSettings() {
  const existing = await prisma.brandingSettings.findFirst({
    where: process.env.NODE_ENV === "production" ? { NOT: { invoiceFooterText: { contains: "Musterstrasse" } } } : undefined,
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;
  return prisma.brandingSettings.create({
    data: {
      primaryColor: "#102033",
      secondaryColor: "#176b36",
      accentColor: "#e0b84d",
      logoUrl: "",
      reportFooterText: "Flyero / digitaler Verteilnachweis",
      invoiceFooterText: "",
    },
  });
}

export async function updateBrandingSettings(data: Prisma.BrandingSettingsUpdateInput, userId?: string | null) {
  const current = await getBrandingSettings();
  const updated = await prisma.brandingSettings.update({ where: { id: current.id }, data });
  await createAuditLog({
    userId,
    action: "settings.branding_updated",
    entityType: "BrandingSettings",
    entityId: updated.id,
    oldValues: current,
    newValues: updated,
  });
  await notifyAdmins({ type: "SETTINGS_CHANGED", title: "Einstellungen geändert", message: "Branding wurde aktualisiert." });
  return updated;
}

export async function getNumberingSettings() {
  const existing = await prisma.numberingSettings.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  return prisma.numberingSettings.create({
    data: {
      invoiceYear: CURRENT_YEAR,
      reportYear: CURRENT_YEAR,
      orderYear: CURRENT_YEAR,
    },
  });
}

export async function updateNumberingSettings(data: Prisma.NumberingSettingsUpdateInput, userId?: string | null) {
  const current = await getNumberingSettings();
  const updated = await prisma.numberingSettings.update({ where: { id: current.id }, data });
  await createAuditLog({
    userId,
    action: "settings.numbering_updated",
    entityType: "NumberingSettings",
    entityId: updated.id,
    oldValues: current,
    newValues: updated,
  });
  await notifyAdmins({ type: "SETTINGS_CHANGED", title: "Einstellungen geändert", message: "Nummernkreise wurden aktualisiert." });
  return updated;
}

export async function getSystemSettings() {
  const existing = await prisma.systemSettings.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  return prisma.systemSettings.create({
    data: {
      defaultVatRate: new Prisma.Decimal("0.19"),
      defaultCurrency: "EUR",
      paymentDueDays: 14,
      allowManualInvoiceCreation: true,
      requirePaymentBeforeReview: true,
      requireAdminReviewAfterPayment: true,
    },
  });
}

export async function getPricingSettings() {
  await ensureDefaultPricingSettings();
  const [settings, rules] = await Promise.all([
    prisma.pricingSetting.findMany({ orderBy: { key: "asc" } }),
    prisma.pricingRule.findMany({
      where: { isActive: true },
      orderBy: [{ serviceType: "asc" }, { minQuantity: "asc" }],
    }),
  ]);
  return { settings, rules };
}

export async function ensureDefaultPricingSettings() {
  const system = await getSystemSettings();
  const defaults = [
    [PRICING_SETTING_KEYS.vatRate, system.defaultVatRate, "Mehrwertsteuersatz für Auftragspreise."],
    [PRICING_SETTING_KEYS.expressSurcharge, new Prisma.Decimal("49.00"), "Optionaler Expresszuschlag netto."],
    [PRICING_SETTING_KEYS.photoProofSurcharge, new Prisma.Decimal("19.00"), "Optionaler Foto-Nachweis-Zuschlag netto."],
    [PRICING_SETTING_KEYS.warehouseSurcharge, new Prisma.Decimal("0.00"), "Optionaler Lagerzuschlag netto."],
  ] as const;

  for (const [key, valueDecimal, description] of defaults) {
    await prisma.pricingSetting.upsert({
      where: { key },
      update: {},
      create: { key, valueDecimal, description },
    });
  }
}

export async function getPaymentConfigStatus() {
  const secretKey = process.env.STRIPE_SECRET_KEY ?? "";
  return {
    stripeConfigured: Boolean(secretKey && !secretKey.includes("_mock") && secretKey !== "sk_test_mock"),
    publishableKeyPresent: Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    secretKeyPresent: Boolean(secretKey),
    webhookSecretPresent: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    testMode: !secretKey || secretKey.includes("_test") || secretKey.includes("_mock") || secretKey === "sk_test_mock",
  };
}

export async function getGoogleMapsConfigStatus() {
  const browserKeyPresent = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY);
  const serverKeyPresent = Boolean(process.env.GOOGLE_MAPS_SERVER_KEY);
  return {
    browserKeyPresent,
    serverKeyPresent,
    mapsFallbackActive: !browserKeyPresent,
    staticMapsAvailable: serverKeyPresent,
  };
}

export async function getDefaultWarehouse() {
  return prisma.warehouse.findFirst({
    where: {
      isActive: true,
      ...(process.env.NODE_ENV === "production" ? { isDemoData: false } : {}),
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}

export type NumberingKind = "invoice" | "report" | "order";

function padNumber(value: number) {
  return String(value).padStart(6, "0");
}

export async function generateSettingsNumber(kind: NumberingKind) {
  const now = new Date();
  const year = now.getFullYear();
  const settings = await getNumberingSettings();

  return prisma.$transaction(async (tx) => {
    const current = await tx.numberingSettings.findUnique({ where: { id: settings.id } });
    if (!current) throw new Error("Nummernkreis wurde nicht gefunden.");

    const config = {
      invoice: {
        yearField: "invoiceYear",
        nextField: "invoiceNextNumber",
        prefixField: "invoicePrefix",
      },
      report: {
        yearField: "reportYear",
        nextField: "reportNextNumber",
        prefixField: "reportPrefix",
      },
      order: {
        yearField: "orderYear",
        nextField: "orderNextNumber",
        prefixField: "orderPrefix",
      },
  }[kind] as {
      yearField: keyof typeof current;
      nextField: keyof typeof current;
      prefixField: keyof typeof current;
    };

    await tx.$queryRaw`SELECT "id" FROM "NumberingSettings" WHERE "id" = ${settings.id} FOR UPDATE`;
    const locked = await tx.numberingSettings.findUnique({ where: { id: settings.id } });
    if (!locked) throw new Error("Nummernkreis wurde nicht gefunden.");

    const storedYear = Number(locked[config.yearField]);
    let nextNumber = storedYear === year ? Number(locked[config.nextField]) : 1;
    const prefix = String(locked[config.prefixField]);
    const candidateExists = async (value: number) => {
      const number = `${prefix}-${year}-${padNumber(value)}`;
      if (kind === "order") return Boolean(await tx.order.findUnique({ where: { orderNumber: number }, select: { id: true } }));
      if (kind === "invoice") return Boolean(await tx.invoice.findUnique({ where: { invoiceNumber: number }, select: { id: true } }));
      return Boolean(await tx.report.findUnique({ where: { reportNumber: number }, select: { id: true } }));
    };
    while (await candidateExists(nextNumber)) nextNumber += 1;
    await tx.numberingSettings.update({
      where: { id: locked.id },
      data: {
        [config.yearField]: year,
        [config.nextField]: nextNumber + 1,
      },
    });
    return `${prefix}-${year}-${padNumber(nextNumber)}`;
  });
}

export async function listInternalUsers() {
  return prisma.user.findMany({
    where: {
      ...productionUserWhere(),
      role: { in: [UserRole.ADMIN, UserRole.WAREHOUSE_STAFF, UserRole.SUPPORT_DISPATCHER] },
    },
    orderBy: [{ role: "asc" }, { email: "asc" }],
    select: { id: true, email: true, role: true, status: true, createdAt: true, updatedAt: true },
  });
}

export async function setInternalUserStatus(input: { userId: string; status: UserStatus; adminUserId: string }) {
  const current = await prisma.user.findFirst({ where: { id: input.userId, ...productionUserWhere() } });
  if (!current) throw new Error("Benutzer wurde nicht gefunden.");
  const internalRoles: UserRole[] = [UserRole.ADMIN, UserRole.WAREHOUSE_STAFF, UserRole.SUPPORT_DISPATCHER];
  if (!internalRoles.includes(current.role)) {
    throw new Error("Nur interne Benutzer können hier geändert werden.");
  }
  const updated = await prisma.user.update({ where: { id: input.userId }, data: { status: input.status } });
  await createAuditLog({
    userId: input.adminUserId,
    action: "settings.user_status_changed",
    entityType: "User",
    entityId: updated.id,
    oldValues: { status: current.status },
    newValues: { status: updated.status },
  });
  if (updated.status === UserStatus.DISABLED) {
    await notifyAdmins({ type: "INTERNAL_USER_DISABLED", title: "Interner Benutzer deaktiviert", message: `${updated.email} wurde deaktiviert.` });
  }
  return updated;
}
