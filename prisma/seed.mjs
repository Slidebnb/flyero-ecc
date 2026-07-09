import bcrypt from "bcryptjs";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import QRCode from "qrcode";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const passwordHash = await bcrypt.hash("DemoPasswort123!", 12);
const reportOutputDir = path.join(process.cwd(), "storage", "generated", "reports");
const invoiceOutputDir = path.join(process.cwd(), "storage", "generated", "invoices");
const accountingOutputDir = path.join(process.cwd(), "storage", "generated", "accounting");

function buildSeedPdf(reportNumber, orderNumber) {
  const text = `BT /F1 18 Tf 50 790 Td (Flyero Verteilbericht) Tj 0 -28 Td (${reportNumber}) Tj 0 -28 Td (Auftrag ${orderNumber}) Tj 0 -28 Td (Seed-PDF für Modul 9) Tj ET`;
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${Buffer.byteLength(text)} >> stream\n${text}\nendstream endobj`,
  ];
  let offset = "%PDF-1.4\n".length;
  const xref = ["0000000000 65535 f "];
  const body = objects.map((object) => {
    xref.push(`${String(offset).padStart(10, "0")} 00000 n `);
    offset += Buffer.byteLength(`${object}\n`);
    return `${object}\n`;
  }).join("");
  return Buffer.from(
    `%PDF-1.4\n${body}xref\n0 ${objects.length + 1}\n${xref.join("\n")}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF`,
  );
}

async function writeSeedReportPdf(reportNumber, orderNumber) {
  await mkdir(reportOutputDir, { recursive: true });
  const pdf = buildSeedPdf(reportNumber, orderNumber);
  const fileName = `${reportNumber.toLowerCase()}.pdf`;
  await writeFile(path.join(reportOutputDir, fileName), pdf);
  return {
    pdfUrl: `/private/generated/reports/${fileName}`,
    checksum: createHash("sha256").update(pdf).digest("hex"),
  };
}

async function writeSeedInvoicePdf(invoiceNumber, orderNumber) {
  await mkdir(invoiceOutputDir, { recursive: true });
  const pdf = buildSeedPdf(invoiceNumber, orderNumber);
  const fileName = `${invoiceNumber.toLowerCase()}.pdf`;
  await writeFile(path.join(invoiceOutputDir, fileName), pdf);
  return {
    pdfUrl: `/private/generated/invoices/${fileName}`,
    checksum: createHash("sha256").update(pdf).digest("hex"),
  };
}

async function writeSeedProofImage(label, fill = "#f0f4f8") {
  const proofId = randomBytes(12).toString("hex");
  const fileName = `${proofId}.svg`;
  const proofOutputDir = path.join(process.cwd(), "storage", "generated", "proofs");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="${fill}"/><text x="320" y="240" text-anchor="middle" fill="#102033" font-size="28" font-family="Arial">${label}</text></svg>`;
  await mkdir(proofOutputDir, { recursive: true });
  await writeFile(path.join(proofOutputDir, fileName), Buffer.from(svg));
  return {
    proofId,
    url: `/api/proofs/${proofId}`,
    metadata: {
      seed: true,
      storedAs: "generated-asset",
      storagePath: `/private/generated/proofs/${fileName}`,
      mimeType: "image/svg+xml",
    },
  };
}

async function ensurePricing() {
  await prisma.pricingSetting.upsert({
    where: { key: "vat_rate" },
    update: {},
    create: {
      key: "vat_rate",
      valueDecimal: new Prisma.Decimal("0.19"),
      description: "Mehrwertsteuersatz für Auftragspreise.",
    },
  });

  for (const [key, valueDecimal, description] of [
    ["express_surcharge", "49.00", "Optionaler Expresszuschlag netto."],
    ["photo_proof_surcharge", "19.00", "Optionaler Foto-Nachweis-Zuschlag netto."],
    ["warehouse_surcharge", "0.00", "Optionaler Lagerzuschlag netto."],
  ]) {
    await prisma.pricingSetting.upsert({
      where: { key },
      update: { valueDecimal: new Prisma.Decimal(valueDecimal), description },
      create: { key, valueDecimal: new Prisma.Decimal(valueDecimal), description },
    });
  }

  const rules = [
    { minQuantity: 1, maxQuantity: 2000, pricePerUnit: "0.14", minimumNetPrice: "250" },
    { minQuantity: 2001, maxQuantity: 5000, pricePerUnit: "0.12", minimumNetPrice: "250" },
    { minQuantity: 5001, maxQuantity: 10000, pricePerUnit: "0.105", minimumNetPrice: "250" },
    { minQuantity: 10001, maxQuantity: null, pricePerUnit: "0.095", minimumNetPrice: "250" },
  ];

  for (const rule of rules) {
    const existing = await prisma.pricingRule.findFirst({
      where: {
        serviceType: "FLYER_DISTRIBUTION",
        minQuantity: rule.minQuantity,
        maxQuantity: rule.maxQuantity,
      },
    });

    if (!existing) {
      await prisma.pricingRule.create({
        data: {
          serviceType: "FLYER_DISTRIBUTION",
          minQuantity: rule.minQuantity,
          maxQuantity: rule.maxQuantity,
          basePrice: new Prisma.Decimal("0"),
          pricePerUnit: new Prisma.Decimal(rule.pricePerUnit),
          minimumNetPrice: new Prisma.Decimal(rule.minimumNetPrice),
        },
      });
    }
  }
}

async function calculateSeedPrice(flyerQuantity) {
  const rule = await prisma.pricingRule.findFirst({
    where: {
      serviceType: "FLYER_DISTRIBUTION",
      isActive: true,
      minQuantity: { lte: flyerQuantity },
      OR: [{ maxQuantity: null }, { maxQuantity: { gte: flyerQuantity } }],
    },
    orderBy: { minQuantity: "desc" },
  });
  const vatRate =
    (await prisma.pricingSetting.findUnique({ where: { key: "vat_rate" } }))
      ?.valueDecimal ?? new Prisma.Decimal("0.19");
  const basePrice = rule?.basePrice ?? new Prisma.Decimal("0");
  const pricePerUnit = rule?.pricePerUnit ?? new Prisma.Decimal("0.12");
  const minimumNetPrice = rule?.minimumNetPrice ?? new Prisma.Decimal("250");
  const net = Prisma.Decimal.max(
    basePrice.plus(pricePerUnit.mul(flyerQuantity)),
    minimumNetPrice,
  ).toDecimalPlaces(2);
  const vat = net.mul(vatRate).toDecimalPlaces(2);

  return {
    net,
    vat,
    gross: net.plus(vat).toDecimalPlaces(2),
    snapshot: {
      serviceType: "FLYER_DISTRIBUTION",
      flyerQuantity,
      basePrice: basePrice.toString(),
      pricePerUnit: pricePerUnit.toString(),
      minimumNetPrice: minimumNetPrice.toString(),
      vatRate: vatRate.toString(),
      ruleId: rule?.id ?? null,
    },
  };
}

await ensurePricing();

const customerSeed = [
  {
    email: "kunde.immobilien@example.com",
    companyName: "Rhein-Mosel Immobilien GmbH",
    contactName: "Anna Schneider",
    phone: "+49 261 1000001",
    city: "Koblenz",
  },
  {
    email: "kunde.autohaus@example.com",
    companyName: "Autohaus Mittelrhein KG",
    contactName: "Markus Weber",
    phone: "+49 2631 1000002",
    city: "Neuwied",
  },
  {
    email: "kunde.pflege@example.com",
    companyName: "PflegePlus Lahnstein",
    contactName: "Sarah Klein",
    phone: "+49 2621 1000003",
    city: "Lahnstein",
  },
];

for (const customer of customerSeed) {
  await prisma.user.upsert({
    where: { email: customer.email },
    update: {},
    create: {
      email: customer.email,
      passwordHash,
      role: "CUSTOMER",
      status: "ACTIVE",
      emailVerified: new Date(),
      customerProfile: {
        create: {
          companyName: customer.companyName,
          contactName: customer.contactName,
          phone: customer.phone,
          vatId: null,
          billingAddress: {
            street: "Musterstrasse",
            houseNumber: "12",
            postalCode: "56068",
            city: customer.city,
            country: "DE",
          },
          deliveryAddress: {
            street: "Lagerweg",
            houseNumber: "4",
            postalCode: "56070",
            city: "Koblenz",
            country: "DE",
          },
        },
      },
    },
  });
}

const distributorSeed = [
  {
    email: "verteiler.pending1@example.com",
    firstName: "Leon",
    lastName: "Hartmann",
    city: "Koblenz",
    status: "PENDING_REVIEW",
    areas: ["Koblenz", "Vallendar"],
  },
  {
    email: "verteiler.pending2@example.com",
    firstName: "Mira",
    lastName: "Scholz",
    city: "Neuwied",
    status: "PENDING_REVIEW",
    areas: ["Neuwied", "Weissenthurm"],
  },
  {
    email: "verteiler.approved1@example.com",
    firstName: "Tobias",
    lastName: "Keller",
    city: "Bendorf",
    status: "APPROVED",
    areas: ["Bendorf", "Vallendar"],
    maxToursPerDay: 3,
    maxFlyersPerDay: 9000,
    availableToday: true,
    rating: "4.70",
  },
  {
    email: "verteiler.approved2@example.com",
    firstName: "Elif",
    lastName: "Demir",
    city: "Andernach",
    status: "APPROVED",
    areas: ["Andernach", "Plaidt"],
    maxToursPerDay: 2,
    maxFlyersPerDay: 6500,
    availableToday: true,
    rating: "4.90",
  },
  {
    email: "verteiler.rejected@example.com",
    firstName: "Jonas",
    lastName: "Becker",
    city: "Lahnstein",
    status: "REJECTED",
    areas: ["Lahnstein", "Koblenz"],
    maxToursPerDay: 1,
    maxFlyersPerDay: 2000,
    availableToday: false,
    rating: "3.40",
  },
  {
    email: "verteiler.approved3@example.com",
    firstName: "Nadine",
    lastName: "Krüger",
    city: "Koblenz",
    status: "APPROVED",
    areas: ["Koblenz", "Mülheim-Kärlich", "Urmitz"],
    maxToursPerDay: 4,
    maxFlyersPerDay: 12000,
    availableToday: true,
    rating: "4.80",
  },
  {
    email: "verteiler.approved4@example.com",
    firstName: "Yasin",
    lastName: "Aydin",
    city: "Neuwied",
    status: "APPROVED",
    areas: ["Neuwied", "Weissenthurm", "Bendorf"],
    maxToursPerDay: 3,
    maxFlyersPerDay: 7500,
    availableToday: true,
    rating: "4.60",
  },
  {
    email: "verteiler.approved5@example.com",
    firstName: "Clara",
    lastName: "Fischer",
    city: "Lahnstein",
    status: "APPROVED",
    areas: ["Lahnstein", "Koblenz"],
    maxToursPerDay: 2,
    maxFlyersPerDay: 3500,
    availableToday: true,
    rating: "4.30",
  },
  {
    email: "verteiler.approved6@example.com",
    firstName: "Mehmet",
    lastName: "Yilmaz",
    city: "Vallendar",
    status: "APPROVED",
    areas: ["Vallendar", "Koblenz", "Bendorf"],
    maxToursPerDay: 5,
    maxFlyersPerDay: 15000,
    availableToday: true,
    rating: "4.95",
  },
  {
    email: "verteiler.paused@example.com",
    firstName: "Sophie",
    lastName: "Lang",
    city: "Plaidt",
    status: "PAUSED",
    areas: ["Plaidt", "Andernach"],
    maxToursPerDay: 2,
    maxFlyersPerDay: 5000,
    availableToday: false,
    rating: "4.10",
  },
];

for (const distributor of distributorSeed) {
  await prisma.user.upsert({
    where: { email: distributor.email },
    update: {
      distributorProfile: {
        update: {
          preferredAreas: distributor.areas,
          serviceRadiusKm: 30,
          reviewStatus: distributor.status,
          availableToday: distributor.availableToday ?? distributor.status === "APPROVED",
          maxToursPerDay: distributor.maxToursPerDay ?? 3,
          maxFlyersPerDay: distributor.maxFlyersPerDay ?? 8000,
          rating: new Prisma.Decimal(distributor.rating ?? "4.50"),
        },
      },
    },
    create: {
      email: distributor.email,
      passwordHash,
      role: "DISTRIBUTOR",
      status: "ACTIVE",
      emailVerified: new Date(),
      distributorProfile: {
        create: {
          firstName: distributor.firstName,
          lastName: distributor.lastName,
          birthDate: new Date("1994-05-14"),
          address: {
            street: "Verteilerweg",
            houseNumber: "8",
            postalCode: "56070",
            city: distributor.city,
            federalState: "Rheinland-Pfalz",
            country: "DE",
          },
          federalState: "Rheinland-Pfalz",
          phone: "+49 170 1000000",
          mobilityType: "BIKE",
          mobilityTypes: ["WALK", "BIKE"],
          preferredAreas: distributor.areas,
          availability: { days: ["Montag", "Mittwoch", "Samstag"] },
          workingTimes: ["Nachmittags", "Abends"],
          serviceRadiusKm: 30,
          maxToursPerDay: distributor.maxToursPerDay ?? 3,
          maxFlyersPerDay: distributor.maxFlyersPerDay ?? 8000,
          availableToday: distributor.availableToday ?? distributor.status === "APPROVED",
          rating: new Prisma.Decimal(distributor.rating ?? "4.50"),
          reviewStatus: distributor.status,
          approvedAt: distributor.status === "APPROVED" ? new Date() : null,
          rejectedAt: distributor.status === "REJECTED" ? new Date() : null,
          taxNumber: "22/123/45678",
          bankAccount: {
            owner: `${distributor.firstName} ${distributor.lastName}`,
            iban: "DE89370400440532013000",
          },
        },
      },
    },
  });
}

const admin = await prisma.user.upsert({
  where: { email: "admin@example.com" },
  update: {},
  create: {
    email: "admin@example.com",
    passwordHash,
    role: "ADMIN",
    status: "ACTIVE",
    emailVerified: new Date(),
  },
});

const warehouseStaff = await prisma.user.upsert({
  where: { email: "warehouse@example.com" },
  update: {},
  create: {
    email: "warehouse@example.com",
    passwordHash,
    role: "WAREHOUSE_STAFF",
    status: "ACTIVE",
    emailVerified: new Date(),
  },
});

const support = await prisma.user.upsert({
  where: { email: "support@example.com" },
  update: {},
  create: {
    email: "support@example.com",
    passwordHash,
    role: "SUPPORT_DISPATCHER",
    status: "ACTIVE",
    emailVerified: new Date(),
  },
});

const disabledWarehouseStaff = await prisma.user.upsert({
  where: { email: "warehouse.inaktiv@example.com" },
  update: {},
  create: {
    email: "warehouse.inaktiv@example.com",
    passwordHash,
    role: "WAREHOUSE_STAFF",
    status: "DISABLED",
    emailVerified: new Date(),
  },
});

async function ensureSingleton(model, data) {
  const existing = await prisma[model].findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return prisma[model].update({ where: { id: existing.id }, data });
  return prisma[model].create({ data });
}

await ensureSingleton("companySettings", {
  companyName: "Flyero",
  legalName: "Flyero GmbH i.G.",
  street: "Musterstrasse 1",
  postalCode: "56068",
  city: "Koblenz",
  country: "DE",
  phone: "+49 261 000000",
  email: "hello@flyero.de",
  website: "https://flyero.de",
  taxNumber: "22/123/45678",
  vatId: "DE000000000",
  bankName: "Demo Bank",
  iban: "DE89370400440532013000",
  bic: "DEMODEFFXXX",
  logoUrl: "/logo.svg",
});

await ensureSingleton("brandingSettings", {
  primaryColor: "#102033",
  secondaryColor: "#176b36",
  accentColor: "#e0b84d",
  logoUrl: "/logo.svg",
  reportFooterText: "Flyero / digitaler Verteilnachweis / powered by ECC",
  invoiceFooterText: "Flyero GmbH i.G. / Musterstrasse 1 / 56068 Koblenz / USt-ID DE000000000",
});

await ensureSingleton("numberingSettings", {
  invoicePrefix: "FLY-RE",
  invoiceYear: new Date().getFullYear(),
  invoiceNextNumber: 1001,
  reportPrefix: "RPT",
  reportYear: new Date().getFullYear(),
  reportNextNumber: 1001,
  orderPrefix: "ORD",
  orderYear: new Date().getFullYear(),
  orderNextNumber: 1001,
});

await ensureSingleton("systemSettings", {
  defaultVatRate: new Prisma.Decimal("0.19"),
  defaultCurrency: "EUR",
  paymentDueDays: 14,
  allowManualInvoiceCreation: true,
  requirePaymentBeforeReview: true,
  requireAdminReviewAfterPayment: true,
  autoDispatchEnabled: false,
  autoDispatchMinScore: 85,
});

const warehouse = await prisma.warehouse.upsert({
  where: { id: "demo-hauptlager-koblenz" },
  update: {
    code: "KOB-HQ",
    country: "DE",
    region: "Rheinland-Pfalz Nord",
    latitude: new Prisma.Decimal("50.3569"),
    longitude: new Prisma.Decimal("7.5890"),
    capacityLimit: 250000,
    currentUtilization: 42000,
    notes: "Zentrales Demo-Lager für Koblenz und Umgebung.",
    isActive: true,
    isDefault: true,
    openingHours: "Mo-Fr 08:00-17:00",
    contactPerson: "Lager Team Koblenz",
    contactPhone: "+49 261 1000090",
    contactEmail: "lager@flyero.de",
  },
  create: {
    id: "demo-hauptlager-koblenz",
    name: "Hauptlager Koblenz",
    code: "KOB-HQ",
    address: {
      street: "Lagerstrasse",
      houseNumber: "12",
      postalCode: "56070",
      city: "Koblenz",
      country: "DE",
    },
    city: "Koblenz",
    postalCode: "56070",
    country: "DE",
    region: "Rheinland-Pfalz Nord",
    latitude: new Prisma.Decimal("50.3569"),
    longitude: new Prisma.Decimal("7.5890"),
    capacityLimit: 250000,
    currentUtilization: 42000,
    notes: "Zentrales Demo-Lager für Koblenz und Umgebung.",
    isActive: true,
    isDefault: true,
    openingHours: "Mo-Fr 08:00-17:00",
    contactPerson: "Lager Team Koblenz",
    contactPhone: "+49 261 1000090",
    contactEmail: "lager@flyero.de",
  },
});

await prisma.warehouse.upsert({
  where: { id: "demo-zweitlager-neuwied" },
  update: {
    code: "NRD-DEP",
    country: "DE",
    region: "Rhein-Wied",
    latitude: new Prisma.Decimal("50.4288"),
    longitude: new Prisma.Decimal("7.4614"),
    capacityLimit: 90000,
    currentUtilization: 18000,
    notes: "Sekundaeres Demo-Lager für Rhein-Wied.",
    isActive: true,
    isDefault: false,
    openingHours: "Mo, Mi, Fr 09:00-15:00",
    contactPerson: "Lager Team Neuwied",
    contactPhone: "+49 2631 1000091",
    contactEmail: "neuwied-lager@flyero.de",
  },
  create: {
    id: "demo-zweitlager-neuwied",
    name: "Zweitlager Neuwied",
    code: "NRD-DEP",
    address: {
      street: "Depotweg",
      houseNumber: "8",
      postalCode: "56564",
      city: "Neuwied",
      country: "DE",
    },
    city: "Neuwied",
    postalCode: "56564",
    country: "DE",
    region: "Rhein-Wied",
    latitude: new Prisma.Decimal("50.4288"),
    longitude: new Prisma.Decimal("7.4614"),
    capacityLimit: 90000,
    currentUtilization: 18000,
    notes: "Sekundaeres Demo-Lager für Rhein-Wied.",
    isActive: true,
    isDefault: false,
    openingHours: "Mo, Mi, Fr 09:00-15:00",
    contactPerson: "Lager Team Neuwied",
    contactPhone: "+49 2631 1000091",
    contactEmail: "neuwied-lager@flyero.de",
  },
});

const locationSeed = [];
for (const aisle of ["A", "B", "C", "D"]) {
  for (let shelf = 1; shelf <= 5; shelf += 1) {
    for (let compartment = 1; compartment <= 2; compartment += 1) {
      const shelfLabel = String(shelf).padStart(2, "0");
      const compartmentLabel = String(compartment).padStart(2, "0");
      locationSeed.push({
        aisle,
        shelf: shelfLabel,
        compartment: compartmentLabel,
        fullLabel: `${aisle}-${shelfLabel}-${compartmentLabel}`,
      });
    }
  }
}

for (const location of locationSeed) {
  await prisma.warehouseLocation.upsert({
    where: {
      warehouseId_fullLabel: {
        warehouseId: warehouse.id,
        fullLabel: location.fullLabel,
      },
    },
    update: {},
    create: {
      warehouseId: warehouse.id,
      aisle: location.aisle,
      shelf: location.shelf,
      compartment: location.compartment,
      fullLabel: location.fullLabel,
    },
  });
}

const warehouseLocations = await prisma.warehouseLocation.findMany({
  where: { warehouseId: warehouse.id },
  orderBy: { fullLabel: "asc" },
});

const module23WarehouseSeed = [
  {
    id: "demo-logistik-koblenz",
    name: "FLYERO Lager Koblenz",
    code: "KOB-M23",
    city: "Koblenz",
    postalCode: "56070",
    region: "Koblenz & Mittelrhein",
    latitude: "50.3569",
    longitude: "7.5890",
    capacityLimit: 260000,
    currentUtilization: 51000,
    postalCodes: ["560", "561"],
    priority: 100,
  },
  {
    id: "demo-logistik-koeln",
    name: "FLYERO Lager Koeln",
    code: "CGN-M23",
    city: "Koeln",
    postalCode: "50667",
    region: "Koeln/Bonn",
    latitude: "50.9375",
    longitude: "6.9603",
    capacityLimit: 420000,
    currentUtilization: 390000,
    postalCodes: ["506", "507", "508", "509"],
    priority: 90,
  },
  {
    id: "demo-logistik-frankfurt",
    name: "FLYERO Lager Frankfurt",
    code: "FRA-M23",
    city: "Frankfurt am Main",
    postalCode: "60311",
    region: "Rhein-Main",
    latitude: "50.1109",
    longitude: "8.6821",
    capacityLimit: 500000,
    currentUtilization: 210000,
    postalCodes: ["603", "604", "605", "659"],
    priority: 80,
  },
  {
    id: "demo-logistik-bonn",
    name: "FLYERO Lager Bonn",
    code: "BN-M23",
    city: "Bonn",
    postalCode: "53111",
    region: "Bonn/Rhein-Sieg",
    latitude: "50.7374",
    longitude: "7.0982",
    capacityLimit: 180000,
    currentUtilization: 35000,
    postalCodes: ["531", "532", "533"],
    priority: 75,
  },
  {
    id: "demo-logistik-mainz",
    name: "FLYERO Lager Mainz",
    code: "MZ-M23",
    city: "Mainz",
    postalCode: "55116",
    region: "Mainz/Wiesbaden",
    latitude: "49.9929",
    longitude: "8.2473",
    capacityLimit: 160000,
    currentUtilization: 22000,
    postalCodes: ["551", "552", "652"],
    priority: 70,
  },
  {
    id: "demo-logistik-inaktiv",
    name: "FLYERO Lager Inaktiv Test",
    code: "OFF-M23",
    city: "Koblenz",
    postalCode: "56068",
    region: "Inaktive Testregion",
    latitude: "50.3569",
    longitude: "7.5890",
    capacityLimit: 999999,
    currentUtilization: 0,
    postalCodes: ["560"],
    priority: 999,
    isActive: false,
  },
];

for (const item of module23WarehouseSeed) {
  const seededWarehouse = await prisma.warehouse.upsert({
    where: { id: item.id },
    update: {
      name: item.name,
      code: item.code,
      city: item.city,
      postalCode: item.postalCode,
      country: "DE",
      region: item.region,
      latitude: new Prisma.Decimal(item.latitude),
      longitude: new Prisma.Decimal(item.longitude),
      capacityLimit: item.capacityLimit,
      currentUtilization: item.currentUtilization,
      isActive: item.isActive ?? true,
      isDefault: false,
      notes: "Modul 23 Demo-Standort für Multi-Lager-Logistik.",
    },
    create: {
      id: item.id,
      name: item.name,
      code: item.code,
      address: {
        street: "Logistikring",
        houseNumber: String(module23WarehouseSeed.indexOf(item) + 10),
        postalCode: item.postalCode,
        city: item.city,
        country: "DE",
      },
      city: item.city,
      postalCode: item.postalCode,
      country: "DE",
      region: item.region,
      latitude: new Prisma.Decimal(item.latitude),
      longitude: new Prisma.Decimal(item.longitude),
      capacityLimit: item.capacityLimit,
      currentUtilization: item.currentUtilization,
      isActive: item.isActive ?? true,
      isDefault: false,
      openingHours: "Mo-Fr 08:00-17:00",
      contactPerson: `Team ${item.city}`,
      contactPhone: "+49 261 1000099",
      contactEmail: `${item.code.toLowerCase()}@flyero.de`,
      notes: "Modul 23 Demo-Standort für Multi-Lager-Logistik.",
    },
  });
  await prisma.warehouseRegion.upsert({
    where: { id: `${item.id}-region` },
    update: {
      warehouseId: seededWarehouse.id,
      name: `${item.city} Zustellregion`,
      city: item.city,
      postalCodes: item.postalCodes,
      radiusKm: 35,
      priority: item.priority,
      isActive: true,
    },
    create: {
      id: `${item.id}-region`,
      warehouseId: seededWarehouse.id,
      name: `${item.city} Zustellregion`,
      city: item.city,
      postalCodes: item.postalCodes,
      radiusKm: 35,
      priority: item.priority,
      isActive: true,
    },
  });
  for (const label of ["M23-A-01", "M23-B-01"]) {
    const [aisle, shelf, compartment] = label.split("-");
    await prisma.warehouseLocation.upsert({
      where: { warehouseId_fullLabel: { warehouseId: seededWarehouse.id, fullLabel: label } },
      update: {},
      create: { warehouseId: seededWarehouse.id, aisle, shelf, compartment, fullLabel: label },
    });
  }
}

await prisma.user.updateMany({
  where: { email: "warehouse@example.com" },
  data: { warehouseId: warehouse.id },
});

const customers = await prisma.customerProfile.findMany({
  orderBy: { createdAt: "asc" },
});

const orderSeed = [
  ["DEMO-ORD-0001", "Koblenz", "56068", "Altstadt Nord", 1500, "SUBMITTED"],
  ["DEMO-ORD-0002", "Neuwied", "56564", "Innenstadt", 3200, "UNDER_REVIEW"],
  ["DEMO-ORD-0003", "Bendorf", "56170", "Bendorf Zentrum", 7500, "APPROVED"],
  ["DEMO-ORD-0004", "Lahnstein", "56112", "Oberlahnstein", 10500, "READY_FOR_FLYERS"],
  ["DEMO-ORD-0005", "Andernach", "56626", "Suedstadt", 2200, "WAITING_FOR_CUSTOMER"],
  ["DEMO-ORD-0006", "Vallendar", "56179", "Rheinufer", 900, "REJECTED"],
  ["DEMO-ORD-0007", "Mülheim-Kärlich", "56218", "Gewerbegebiet", 6000, "CANCELLED"],
  ["DEMO-ORD-0008", "Urmitz", "56220", "Urmitz Bahnhof", 4200, "SUBMITTED"],
  ["DEMO-ORD-0009", "Weissenthurm", "56575", "Weissenthurm Mitte", 9800, "UNDER_REVIEW"],
  ["DEMO-ORD-0010", "Plaidt", "56637", "Plaidt Nord", 12500, "APPROVED"],
];

for (let index = 0; index < orderSeed.length; index += 1) {
  const [orderNumber, city, postalCode, area, flyerQuantity, status] = orderSeed[index];
  const customer = customers[index % customers.length];
  const price = await calculateSeedPrice(flyerQuantity);
  const start = new Date();
  start.setDate(start.getDate() + index + 2);
  const end = new Date(start);
  end.setDate(end.getDate() + 5);

  const order = await prisma.order.upsert({
    where: { orderNumber },
    update: {},
    create: {
      orderNumber,
      customerId: customer.id,
      status,
      serviceType: "FLYER_DISTRIBUTION",
      city,
      postalCode,
      targetAddress: {
        street: "Verteilstrasse",
        houseNumber: String(index + 1),
        postalCode,
        city,
        country: "DE",
      },
      targetAreaName: area,
      targetAreaGeoJson: null,
      estimatedHouseholds: Math.round(flyerQuantity * 0.85),
      flyerQuantity,
      customerOwnFlyers: index % 3 !== 0,
      needsPrintService: index % 3 === 0,
      preferredStartDate: start,
      preferredEndDate: end,
      flexibleScheduling: index % 2 === 0,
      notes: "Demoauftrag für Modul 3.",
      contactPerson: customer.contactName,
      contactPhone: customer.phone,
      calculatedNetPrice: price.net,
      calculatedVat: price.vat,
      calculatedGrossPrice: price.gross,
      priceRuleSnapshot: price.snapshot,
    },
  });

  const existingEvent = await prisma.orderStatusEvent.findFirst({
    where: { orderId: order.id },
  });
  if (!existingEvent) {
    await prisma.orderStatusEvent.create({
      data: {
        orderId: order.id,
        toStatus: status,
        changedBy: admin.id,
        note: "Seed-Auftrag angelegt.",
      },
    });
  }
}

const stripeProvider = await prisma.paymentProvider.upsert({
  where: { code: "stripe" },
  update: { active: true, name: "Stripe" },
  create: { code: "stripe", name: "Stripe", active: true },
});

const paymentOrders = await prisma.order.findMany({
  where: { orderNumber: { startsWith: "DEMO-ORD-" } },
  include: { customer: true },
  orderBy: { orderNumber: "asc" },
  take: 10,
});
const paymentSeed = [
  ["PAID", "PAID_WAITING_FOR_ADMIN_REVIEW", null],
  ["PAID", "PAID_WAITING_FOR_ADMIN_REVIEW", null],
  ["FAILED", "PAYMENT_FAILED", null],
  ["CHECKOUT_CREATED", "PAYMENT_PENDING", null],
  ["REFUNDED", "REJECTED", "FULL"],
  ["PARTIALLY_REFUNDED", "PAID_WAITING_FOR_ADMIN_REVIEW", "PARTIAL"],
  ["CANCELLED", "PAYMENT_FAILED", null],
  ["PENDING", "PAYMENT_PENDING", null],
  ["PAID", "PAID_WAITING_FOR_ADMIN_REVIEW", null],
  ["FAILED", "PAYMENT_FAILED", null],
];

for (let index = 0; index < paymentOrders.length; index += 1) {
  const order = paymentOrders[index];
  const [paymentStatus, orderStatus, refundType] = paymentSeed[index];
  const sessionId = `cs_test_seed_${String(index + 1).padStart(4, "0")}`;
  const intentId = `pi_seed_${String(index + 1).padStart(4, "0")}`;
  const amount = order.manualPriceOverride ?? order.calculatedGrossPrice;
  await prisma.order.update({
    where: { id: order.id },
    data: { status: orderStatus },
  });
  const existingStatusEvent = await prisma.orderStatusEvent.findFirst({
    where: { orderId: order.id, toStatus: orderStatus },
  });
  if (!existingStatusEvent) {
    await prisma.orderStatusEvent.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: orderStatus,
        changedBy: admin.id,
        note: "Seed-Zahlungsstatus für Modul 10.",
      },
    });
  }
  const payment = await prisma.payment.upsert({
    where: { stripeCheckoutSessionId: sessionId },
    update: {
      status: paymentStatus,
      amount,
      stripePaymentIntentId: intentId,
      paidAt: ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"].includes(paymentStatus) ? new Date() : null,
      failedAt: paymentStatus === "FAILED" ? new Date() : null,
      cancelledAt: paymentStatus === "CANCELLED" ? new Date() : null,
      refundedAt: ["REFUNDED", "PARTIALLY_REFUNDED"].includes(paymentStatus) ? new Date() : null,
    },
    create: {
      orderId: order.id,
      customerId: order.customerId,
      providerId: stripeProvider.id,
      status: paymentStatus,
      amount,
      currency: "EUR",
      description: `Flyero Auftrag ${order.orderNumber}`,
      checkoutUrl: `https://checkout.stripe.com/c/pay/seed-${index + 1}`,
      stripeCheckoutSessionId: sessionId,
      stripePaymentIntentId: intentId,
      paidAt: ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"].includes(paymentStatus) ? new Date() : null,
      failedAt: paymentStatus === "FAILED" ? new Date() : null,
      cancelledAt: paymentStatus === "CANCELLED" ? new Date() : null,
      refundedAt: ["REFUNDED", "PARTIALLY_REFUNDED"].includes(paymentStatus) ? new Date() : null,
      metadata: { orderId: order.id, customerId: order.customerId, report: "prepared_for_module_11", seed: true },
    },
  });
  const history = await prisma.paymentStatusHistory.findFirst({
    where: { paymentId: payment.id, toStatus: paymentStatus },
  });
  if (!history) {
    await prisma.paymentStatusHistory.create({
      data: { paymentId: payment.id, toStatus: paymentStatus, reason: "seed-module10" },
    });
  }
  const event = await prisma.paymentEvent.findUnique({ where: { stripeEventId: `evt_seed_${String(index + 1).padStart(4, "0")}` } });
  if (!event) {
    await prisma.paymentEvent.create({
      data: {
        paymentId: payment.id,
        providerId: stripeProvider.id,
        stripeEventId: `evt_seed_${String(index + 1).padStart(4, "0")}`,
        type: paymentStatus === "FAILED" ? "payment_intent.payment_failed" : paymentStatus === "CANCELLED" ? "checkout.session.expired" : "checkout.session.completed",
        payload: { seed: true, paymentStatus, orderNumber: order.orderNumber },
        processedAt: new Date(),
      },
    });
  }
  if (refundType) {
    const existingRefund = await prisma.refund.findFirst({ where: { paymentId: payment.id } });
    if (!existingRefund) {
      await prisma.refund.create({
        data: {
          paymentId: payment.id,
          orderId: order.id,
          customerId: order.customerId,
          type: refundType,
          status: "SUCCEEDED",
          amount: refundType === "PARTIAL" ? amount.div(2).toDecimalPlaces(2) : amount,
          currency: "EUR",
          reason: "Seed-Refund für Modul 10.",
          stripeRefundId: `re_seed_${String(index + 1).padStart(4, "0")}`,
          requestedById: admin.id,
          processedAt: new Date(),
        },
      });
    }
  }
}

for (const action of ["payment.checkout_created", "payment.completed", "payment.failed", "payment.refunded", "payment.partial_refunded", "payment.webhook_received"]) {
  const existing = await prisma.auditLog.findFirst({ where: { action, entityType: { in: ["Payment", "PaymentEvent"] } } });
  if (!existing) {
    await prisma.auditLog.create({
      data: {
        userId: action === "payment.webhook_received" ? null : admin.id,
        action,
        entityType: action === "payment.webhook_received" ? "PaymentEvent" : "Payment",
        entityId: `seed-${action}`,
        newValues: { seed: true, module: 10 },
      },
    });
  }
}

await prisma.notification.createMany({
  data: [
    {
      userId: customers[0].userId,
      type: "PAYMENT_SUCCESS",
      title: "Zahlung erfolgreich",
      message: "Seed-Zahlung erfolgreich.",
    },
    {
      userId: customers[1].userId,
      type: "PAYMENT_FAILED",
      title: "Zahlung fehlgeschlagen",
      message: "Seed-Zahlung fehlgeschlagen.",
    },
    {
      userId: customers[2].userId,
      type: "PAYMENT_REFUNDED",
      title: "Rueckerstattung erfolgt",
      message: "Seed-Rueckerstattung erfolgt.",
    },
    {
      userId: admin.id,
      type: "PAYMENT_COMPLETED",
      title: "Neue bezahlte Bestellung",
      message: "Seed: bezahlter Auftrag wartet auf Prüfung.",
    },
    {
      userId: admin.id,
      type: "PAYMENT_REFUNDED",
      title: "Rueckerstattung durchgefuehrt",
      message: "Seed: Rueckerstattung durchgefuehrt.",
    },
  ],
});

const invoicePayments = await prisma.payment.findMany({
  where: { order: { orderNumber: { startsWith: "DEMO-ORD-" } } },
  include: { order: true, customer: true },
  orderBy: { order: { orderNumber: "asc" } },
  take: 10,
});
for (let index = 0; index < invoicePayments.length; index += 1) {
  const payment = invoicePayments[index];
  const invoiceNumber = `FLY-RE-2026-${String(index + 1).padStart(6, "0")}`;
  const subtotalNet = payment.order.manualPriceOverride ?? payment.order.calculatedNetPrice;
  const vatRate = new Prisma.Decimal("0.19");
  const vatAmount = subtotalNet.mul(vatRate).toDecimalPlaces(2);
  const totalGross = subtotalNet.plus(vatAmount).toDecimalPlaces(2);
  const pdf = await writeSeedInvoicePdf(invoiceNumber, payment.order.orderNumber);
  const invoiceStatus = index === 4 ? "CANCELLED" : "PAID";
  const invoice = await prisma.invoice.upsert({
    where: { orderId: payment.orderId },
    update: {
      paymentId: payment.id,
      invoiceNumber,
      status: invoiceStatus,
      currency: payment.currency,
      invoiceDate: new Date(),
      serviceDate: payment.order.preferredStartDate,
      dueDate: new Date(),
      paidAt: payment.paidAt ?? new Date(),
      subtotalNet,
      vatRate,
      vatAmount,
      totalGross,
      amountNet: subtotalNet,
      amountGross: totalGross,
      pdfUrl: pdf.pdfUrl,
      notes: "Seed-Rechnung für Modul 11.",
    },
    create: {
      orderId: payment.orderId,
      customerId: payment.customerId,
      paymentId: payment.id,
      invoiceNumber,
      status: invoiceStatus,
      currency: payment.currency,
      invoiceDate: new Date(),
      serviceDate: payment.order.preferredStartDate,
      dueDate: new Date(),
      paidAt: payment.paidAt ?? new Date(),
      subtotalNet,
      vatRate,
      vatAmount,
      totalGross,
      amountNet: subtotalNet,
      amountGross: totalGross,
      pdfUrl: pdf.pdfUrl,
      notes: "Seed-Rechnung für Modul 11.",
    },
  });
  const existingItem = await prisma.invoiceItem.findFirst({ where: { invoiceId: invoice.id } });
  if (!existingItem) {
    await prisma.invoiceItem.create({
      data: {
        invoiceId: invoice.id,
        title: "Flyerverteilung",
        description: `Flyerverteilung ${payment.order.targetAreaName}, ${payment.order.city}`,
        quantity: new Prisma.Decimal(payment.order.flyerQuantity),
        unit: "Flyer",
        unitPriceNet: subtotalNet.div(payment.order.flyerQuantity).toDecimalPlaces(4),
        vatRate,
        lineTotalNet: subtotalNet,
      },
    });
  }
  if (index === 4) {
    const existingCreditNote = await prisma.creditNote.findFirst({ where: { invoiceId: invoice.id } });
    if (!existingCreditNote) {
      await prisma.creditNote.create({
        data: {
          creditNoteNumber: "FLY-GS-2026-000001",
          invoiceId: invoice.id,
          reason: "Seed-Gutschrift vorbereitet.",
          amountNet: subtotalNet,
          vatAmount,
          totalGross,
          status: "PREPARED",
        },
      });
    }
  }
}

for (const action of ["invoice.created", "invoice.pdf_generated", "invoice.pdf_regenerated", "invoice.downloaded", "invoice.cancelled", "credit_note.prepared"]) {
  const existing = await prisma.auditLog.findFirst({ where: { action } });
  if (!existing) {
    await prisma.auditLog.create({
      data: {
        userId: action === "invoice.downloaded" ? customers[0].userId : admin.id,
        action,
        entityType: action === "credit_note.prepared" ? "CreditNote" : "Invoice",
        entityId: `seed-${action}`,
        newValues: { seed: true, module: 11 },
      },
    });
  }
}
await prisma.notification.createMany({
  data: [
    {
      userId: customers[0].userId,
      type: "INVOICE_AVAILABLE",
      title: "Rechnung verfügbar",
      message: "Seed-Rechnung ist im Kundenportal verfügbar.",
    },
    {
      userId: admin.id,
      type: "INVOICE_CREATED",
      title: "Rechnung erstellt",
      message: "Seed-Rechnung wurde erstellt.",
    },
    {
      userId: admin.id,
      type: "INVOICE_PDF_REGENERATED",
      title: "Rechnung PDF neu erzeugt",
      message: "Seed-Rechnung PDF neu erzeugt.",
    },
  ],
});

const warehouseOrderSeed = [
  ["DEMO-WH-0001", "Koblenz", "56068", "Altstadt Lagerroute", 2000, "FLYERS_EXPECTED", "FLYERS_EXPECTED", "NOT_RELEVANT"],
  ["DEMO-WH-0002", "Neuwied", "56564", "Innenstadt Lagerroute", 3400, "FLYERS_EXPECTED", "FLYERS_EXPECTED", "NOT_RELEVANT"],
  ["DEMO-WH-0003", "Bendorf", "56170", "Zentrum Lagerroute", 5100, "FLYERS_RECEIVED", "FLYERS_RECEIVED", "NOT_RELEVANT"],
  ["DEMO-WH-0004", "Lahnstein", "56112", "Oberlahnstein Lagerroute", 7600, "FLYERS_RECEIVED", "FLYERS_RECEIVED", "NOT_RELEVANT"],
  ["DEMO-WH-0005", "Andernach", "56626", "Suedstadt Lagerroute", 4200, "STORED", "STORED", "NOT_RELEVANT"],
  ["DEMO-WH-0006", "Vallendar", "56179", "Rheinufer Lagerroute", 1800, "STORED", "STORED", "RESTBESTAND"],
  ["DEMO-WH-0007", "Mülheim-Kärlich", "56218", "Gewerbegebiet Lagerroute", 6200, "READY_FOR_PICKUP", "READY_FOR_PICKUP", "NOT_RELEVANT"],
  ["DEMO-WH-0008", "Urmitz", "56220", "Bahnhof Lagerroute", 2900, "READY_FOR_PICKUP", "READY_FOR_PICKUP", "RESTBESTAND"],
  ["DEMO-WH-0009", "Weissenthurm", "56575", "Mitte Lagerroute", 8800, "STORED", "STORED", "ENTSORGT"],
  ["DEMO-WH-0010", "Plaidt", "56637", "Nord Lagerroute", 11300, "READY_FOR_PICKUP", "READY_FOR_PICKUP", "RUECKVERSAND"],
];

for (let index = 0; index < warehouseOrderSeed.length; index += 1) {
  const [orderNumber, city, postalCode, area, flyerQuantity, orderStatus, inventoryStatus, remainingStockStatus] =
    warehouseOrderSeed[index];
  const customer = customers[index % customers.length];
  const price = await calculateSeedPrice(flyerQuantity);
  const start = new Date();
  start.setDate(start.getDate() + index + 14);
  const end = new Date(start);
  end.setDate(end.getDate() + 4);

  const order = await prisma.order.upsert({
    where: { orderNumber },
    update: {
      status: orderStatus,
    },
    create: {
      orderNumber,
      customerId: customer.id,
      status: orderStatus,
      serviceType: "FLYER_DISTRIBUTION",
      city,
      postalCode,
      targetAddress: {
        street: "Lager-Demo-Strasse",
        houseNumber: String(index + 11),
        postalCode,
        city,
        country: "DE",
      },
      targetAreaName: area,
      targetAreaGeoJson: null,
      estimatedHouseholds: Math.round(flyerQuantity * 0.82),
      flyerQuantity,
      customerOwnFlyers: true,
      needsPrintService: false,
      preferredStartDate: start,
      preferredEndDate: end,
      flexibleScheduling: index % 2 === 0,
      notes: "Demoauftrag für Modul 4 Lagerverwaltung.",
      contactPerson: customer.contactName,
      contactPhone: customer.phone,
      calculatedNetPrice: price.net,
      calculatedVat: price.vat,
      calculatedGrossPrice: price.gross,
      priceRuleSnapshot: price.snapshot,
    },
  });

  const location = warehouseLocations[index % warehouseLocations.length];
  const receivedFlyers = inventoryStatus === "FLYERS_EXPECTED" ? null : flyerQuantity;
  const remainingFlyers = inventoryStatus === "FLYERS_EXPECTED" ? null : Math.max(flyerQuantity - index * 35, 0);
  const preparedAt = inventoryStatus === "READY_FOR_PICKUP" ? new Date() : null;
  const qrPayloadBase = { orderNumber: order.orderNumber, warehouseId: warehouse.id };

  const inventory = await prisma.warehouseInventory.upsert({
    where: { orderId: order.id },
    update: {
      warehouseLocationId: location.id,
      status: inventoryStatus,
      remainingStockStatus,
      cartonCount: index + 2,
      expectedFlyers: flyerQuantity,
      receivedFlyers,
      remainingFlyers,
      damagedFlyers: inventoryStatus === "FLYERS_EXPECTED" ? null : index * 3,
      pickupStatus: inventoryStatus === "READY_FOR_PICKUP" ? "PREPARED" : "NOT_PREPARED",
      preparedAt,
      receivedAt: inventoryStatus === "FLYERS_EXPECTED" ? null : new Date(),
      notes: "Seed-Lagerbestand für Modul 4.",
    },
    create: {
      orderId: order.id,
      warehouseLocationId: location.id,
      status: inventoryStatus,
      remainingStockStatus,
      qrCode: `pending-${order.id}`,
      pickupToken: randomBytes(24).toString("base64url"),
      cartonCount: index + 2,
      expectedFlyers: flyerQuantity,
      receivedFlyers,
      remainingFlyers,
      damagedFlyers: inventoryStatus === "FLYERS_EXPECTED" ? null : index * 3,
      pickupStatus: inventoryStatus === "READY_FOR_PICKUP" ? "PREPARED" : "NOT_PREPARED",
      preparedAt,
      receivedAt: inventoryStatus === "FLYERS_EXPECTED" ? null : new Date(),
      notes: "Seed-Lagerbestand für Modul 4.",
    },
  });

  const qrCode = JSON.stringify({ ...qrPayloadBase, inventoryId: inventory.id });
  await prisma.warehouseInventory.update({
    where: { id: inventory.id },
    data: {
      qrCode,
      qrCodePngDataUrl: await QRCode.toDataURL(qrCode, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 420,
      }),
    },
  });

  const existingEvent = await prisma.orderStatusEvent.findFirst({
    where: { orderId: order.id, toStatus: orderStatus },
  });
  if (!existingEvent) {
    await prisma.orderStatusEvent.create({
      data: {
        orderId: order.id,
        toStatus: orderStatus,
        changedBy: admin.id,
        note: "Seed-Lagerauftrag angelegt.",
      },
    });
  }

  const existingHistory = await prisma.warehouseHistory.findFirst({
    where: { inventoryId: inventory.id, action: "seed.module4_inventory" },
  });
  if (!existingHistory) {
    await prisma.warehouseHistory.create({
      data: {
        inventoryId: inventory.id,
        action: "seed.module4_inventory",
        userId: warehouseStaff.id,
        newValue: {
          orderNumber,
          status: inventoryStatus,
          location: location.fullLabel,
        },
      },
    });
  }
}

const approvedDistributors = await prisma.distributorProfile.findMany({
  where: { reviewStatus: "APPROVED" },
  include: { user: true },
  orderBy: { createdAt: "asc" },
});
const tourInventory = await prisma.warehouseInventory.findMany({
  where: { order: { orderNumber: { startsWith: "DEMO-WH-" } } },
  include: { order: true },
  orderBy: { order: { orderNumber: "asc" } },
  take: 5,
});
const tourStatuses = ["ASSIGNED", "PICKED_UP", "STARTED", "PAUSED", "UNDER_REVIEW"];

for (let index = 0; index < tourInventory.length; index += 1) {
  const inventory = tourInventory[index];
  const distributor = approvedDistributors[index % approvedDistributors.length];
  const status = tourStatuses[index];
  const now = new Date();
  const startTime = ["STARTED", "PAUSED", "UNDER_REVIEW"].includes(status)
    ? new Date(now.getTime() - (index + 1) * 60 * 60 * 1000)
    : null;
  const endTime = status === "UNDER_REVIEW" ? new Date(now.getTime() - 15 * 60 * 1000) : null;

  await prisma.warehouseInventory.update({
    where: { id: inventory.id },
    data: {
      reservedDistributorId: distributor.id,
      status: status === "ASSIGNED" ? "READY_FOR_PICKUP" : "PICKED_UP",
      pickupStatus: status === "ASSIGNED" ? "RESERVED" : "PICKED_UP",
      pickedUpAt: status === "ASSIGNED" ? null : new Date(now.getTime() - 2 * 60 * 60 * 1000),
    },
  });

  const tour = await prisma.distributionTour.upsert({
    where: { id: `demo-tour-${index + 1}` },
    update: {
      orderId: inventory.orderId,
      inventoryId: inventory.id,
      distributorId: distributor.id,
      status,
      pickupTime: status === "ASSIGNED" ? null : new Date(now.getTime() - 2 * 60 * 60 * 1000),
      startTime,
      endTime,
      pauseTime: status === "PAUSED" ? new Date(now.getTime() - 12 * 60 * 1000) : null,
      totalPauseSeconds: status === "UNDER_REVIEW" ? 420 : 0,
      totalDistanceMeters: index * 1200,
      totalDurationSeconds: status === "UNDER_REVIEW" ? 5400 : null,
      startedAt: startTime,
      pausedAt: status === "PAUSED" ? new Date(now.getTime() - 12 * 60 * 1000) : null,
      completedAt: endTime,
      remainingFlyers: status === "UNDER_REVIEW" ? 35 : null,
      distributorNotes: status === "UNDER_REVIEW" ? "Seed-Tour abgeschlossen." : null,
      fraudFlags: index === 4 ? { latest: ["time_gap", "large_jump"], missingPhotos: false } : null,
    },
    create: {
      id: `demo-tour-${index + 1}`,
      orderId: inventory.orderId,
      inventoryId: inventory.id,
      distributorId: distributor.id,
      status,
      pickupTime: status === "ASSIGNED" ? null : new Date(now.getTime() - 2 * 60 * 60 * 1000),
      startTime,
      endTime,
      pauseTime: status === "PAUSED" ? new Date(now.getTime() - 12 * 60 * 1000) : null,
      totalPauseSeconds: status === "UNDER_REVIEW" ? 420 : 0,
      totalDistanceMeters: index * 1200,
      totalDurationSeconds: status === "UNDER_REVIEW" ? 5400 : null,
      startedAt: startTime,
      pausedAt: status === "PAUSED" ? new Date(now.getTime() - 12 * 60 * 1000) : null,
      completedAt: endTime,
      remainingFlyers: status === "UNDER_REVIEW" ? 35 : null,
      distributorNotes: status === "UNDER_REVIEW" ? "Seed-Tour abgeschlossen." : null,
      fraudFlags: index === 4 ? { latest: ["time_gap", "large_jump"], missingPhotos: false } : null,
    },
  });

  await prisma.gpsPoint.deleteMany({ where: { tourId: tour.id } });
  await prisma.photoProof.deleteMany({ where: { tourId: tour.id } });

  if (["STARTED", "PAUSED", "UNDER_REVIEW"].includes(status)) {
    await prisma.gpsPoint.createMany({
      data: Array.from({ length: 4 }).map((_, pointIndex) => ({
        tourId: tour.id,
        lat: new Prisma.Decimal(50.356 + index * 0.01 + pointIndex * 0.001),
        lng: new Prisma.Decimal(7.594 + index * 0.01 + pointIndex * 0.001),
        accuracy: new Prisma.Decimal(pointIndex === 3 && index === 4 ? 180 : 12),
        speed: new Prisma.Decimal(pointIndex === 2 && index === 4 ? 18 : 2.5),
        heading: new Prisma.Decimal(90 + pointIndex * 4),
        altitude: new Prisma.Decimal(80 + pointIndex),
        battery: 85 - pointIndex * 3,
        source: "seed",
        status: pointIndex === 3 && index === 4 ? "flagged" : "ok",
        flags: pointIndex === 3 && index === 4 ? ["gps_weak_or_disabled", "computed_speed_high"] : undefined,
        recordedAt: new Date((startTime ?? now).getTime() + pointIndex * 15 * 1000),
      })),
    });
  }

  if (["PAUSED", "UNDER_REVIEW"].includes(status)) {
    const seedProof = await writeSeedProofImage("Demo-Tourfoto");
    await prisma.photoProof.create({
      data: {
        id: seedProof.proofId,
        tourId: tour.id,
        orderId: inventory.orderId,
        uploadedBy: distributor.userId,
        url: seedProof.url,
        lat: new Prisma.Decimal(50.356 + index * 0.01),
        lng: new Prisma.Decimal(7.594 + index * 0.01),
        accuracy: new Prisma.Decimal(14),
        source: "camera",
        takenAt: new Date(),
        metadata: seedProof.metadata,
      },
    });
  }

  const existingTourAudit = await prisma.auditLog.findFirst({
    where: { action: "tour.assigned", entityType: "DistributionTour", entityId: tour.id },
  });
  if (!existingTourAudit) {
    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: "tour.assigned",
        entityType: "DistributionTour",
        entityId: tour.id,
        newValues: { status, seed: true },
      },
    });
  }
}

const module6Inventory = await prisma.warehouseInventory.findMany({
  where: { order: { orderNumber: { startsWith: "DEMO-WH-" } } },
  include: { order: true },
  orderBy: { order: { orderNumber: "asc" } },
  skip: 5,
  take: 3,
});
const module6Tours = [
  { id: "demo-tour-6-approved-preview", status: "APPROVED", pointCount: 6, flags: [], reportStatus: "PUBLISHED" },
  { id: "demo-tour-7-too-few-points", status: "NEEDS_CLARIFICATION", pointCount: 2, flags: ["TOO_FEW_POINTS"], reportStatus: "DRAFT" },
  { id: "demo-tour-8-unrealistic-speed", status: "REJECTED", pointCount: 4, flags: ["UNREALISTIC_SPEED", "LARGE_GAP"], report: false },
];

for (let index = 0; index < module6Inventory.length; index += 1) {
  const inventory = module6Inventory[index];
  const route = module6Tours[index];
  const distributor = approvedDistributors[index % approvedDistributors.length];
  const now = new Date();
  const startTime = new Date(now.getTime() - (index + 2) * 60 * 60 * 1000);
  const endTime = new Date(startTime.getTime() + 55 * 60 * 1000);

  await prisma.warehouseInventory.update({
    where: { id: inventory.id },
    data: {
      reservedDistributorId: distributor.id,
      status: "PICKED_UP",
      pickupStatus: "PICKED_UP",
      remainingFlyers: index === 0 ? 0 : 120,
      remainingStockStatus: index === 0 ? "ALLE_VERTEILT" : "RESTBESTAND",
    },
  });

  const tour = await prisma.distributionTour.upsert({
    where: { id: route.id },
    update: {
      orderId: inventory.orderId,
      inventoryId: inventory.id,
      distributorId: distributor.id,
      status: route.status,
      pickupTime: new Date(startTime.getTime() - 30 * 60 * 1000),
      startTime,
      endTime,
      totalPauseSeconds: 300,
      totalDistanceMeters: index === 2 ? 18000 : 2600 + index * 400,
      totalDurationSeconds: 3000,
      remainingFlyers: index === 0 ? 0 : 120,
      distributorNotes: "Seed-Tour für Modul 6.",
      adminInternalNote: route.status === "REJECTED" ? "Geschwindigkeit unrealistisch." : "Seed-Prüfung.",
      adminCustomerMessage: route.reportStatus ? "Verteilung geprueft und freigegeben." : null,
      reviewedAt: new Date(),
      reviewedBy: admin.id,
      adminReviewStatus: route.status === "APPROVED" ? "APPROVED" : route.status === "REJECTED" ? "REJECTED" : "NEEDS_REVIEW",
      fraudFlags: { routeAnalysis: route.flags },
    },
    create: {
      id: route.id,
      orderId: inventory.orderId,
      inventoryId: inventory.id,
      distributorId: distributor.id,
      status: route.status,
      pickupTime: new Date(startTime.getTime() - 30 * 60 * 1000),
      startTime,
      endTime,
      totalPauseSeconds: 300,
      totalDistanceMeters: index === 2 ? 18000 : 2600 + index * 400,
      totalDurationSeconds: 3000,
      remainingFlyers: index === 0 ? 0 : 120,
      distributorNotes: "Seed-Tour für Modul 6.",
      adminInternalNote: route.status === "REJECTED" ? "Geschwindigkeit unrealistisch." : "Seed-Prüfung.",
      adminCustomerMessage: route.reportStatus ? "Verteilung geprueft und freigegeben." : null,
      reviewedAt: new Date(),
      reviewedBy: admin.id,
      adminReviewStatus: route.status === "APPROVED" ? "APPROVED" : route.status === "REJECTED" ? "REJECTED" : "NEEDS_REVIEW",
      fraudFlags: { routeAnalysis: route.flags },
    },
  });

  await prisma.gpsPoint.deleteMany({ where: { tourId: tour.id } });
  await prisma.photoProof.deleteMany({ where: { tourId: tour.id } });
  await prisma.gpsPoint.createMany({
    data: Array.from({ length: route.pointCount }).map((_, pointIndex) => ({
      tourId: tour.id,
      lat: new Prisma.Decimal(50.36 + index * 0.015 + pointIndex * (index === 2 ? 0.04 : 0.001)),
      lng: new Prisma.Decimal(7.60 + index * 0.015 + pointIndex * (index === 2 ? 0.04 : 0.001)),
      accuracy: new Prisma.Decimal(12),
      speed: new Prisma.Decimal(index === 2 && pointIndex > 0 ? 35 : 2.8),
      heading: new Prisma.Decimal(80 + pointIndex),
      source: "seed-module6",
      status: route.flags.length && pointIndex === route.pointCount - 1 ? "flagged" : "ok",
      flags: route.flags.length && pointIndex === route.pointCount - 1 ? route.flags : undefined,
      recordedAt: new Date(startTime.getTime() + pointIndex * 15 * 1000),
    })),
  });
  const seedProof = await writeSeedProofImage("Modul-6-Foto");
  await prisma.photoProof.create({
    data: {
      id: seedProof.proofId,
      tourId: tour.id,
      orderId: inventory.orderId,
      uploadedBy: distributor.userId,
      url: seedProof.url,
      lat: new Prisma.Decimal(50.36 + index * 0.015),
      lng: new Prisma.Decimal(7.60 + index * 0.015),
      accuracy: new Prisma.Decimal(12),
      source: "camera",
      takenAt: endTime,
      metadata: {
        ...seedProof.metadata,
        seed: true,
        module: 6,
      },
    },
  });
  if (route.reportStatus) {
    await prisma.order.update({
      where: { id: inventory.orderId },
      data: { status: route.reportStatus === "DRAFT" ? "UNDER_REVIEW" : "REPORT_READY_PREVIEW" },
    });
    const reportNumber = `RPT-SEED-${String(index + 1).padStart(4, "0")}`;
    const generatedAt = new Date();
    const publishedPdf = route.reportStatus === "PUBLISHED"
      ? await writeSeedReportPdf(reportNumber, inventory.order.orderNumber)
      : { pdfUrl: null, checksum: null };
    const report = await prisma.report.upsert({
      where: { tourId: tour.id },
      update: {
        customerId: inventory.order.customerId,
        reportNumber,
        status: route.reportStatus,
        reportType: "DISTRIBUTION_PROOF",
        template: index === 0 ? "STANDARD" : "IMMOBILIEN",
        generatedAt,
        approvedAt: route.reportStatus === "DRAFT" ? null : generatedAt,
        approvedById: route.reportStatus === "DRAFT" ? null : admin.id,
        pdfUrl: publishedPdf.pdfUrl,
        checksum: publishedPdf.checksum,
      },
      create: {
        orderId: inventory.orderId,
        tourId: tour.id,
        customerId: inventory.order.customerId,
        reportNumber,
        status: route.reportStatus,
        reportType: "DISTRIBUTION_PROOF",
        template: index === 0 ? "STANDARD" : "IMMOBILIEN",
        onlineUrl: "",
        generatedAt,
        approvedAt: route.reportStatus === "DRAFT" ? null : generatedAt,
        approvedById: route.reportStatus === "DRAFT" ? null : admin.id,
        pdfUrl: publishedPdf.pdfUrl,
        checksum: publishedPdf.checksum,
        verificationCode: `VRF-SEED-${String(index + 1).padStart(4, "0")}`,
      },
    });
    await prisma.report.update({
      where: { id: report.id },
      data: { onlineUrl: `/customer/reports/${report.id}` },
    });
    for (const action of route.reportStatus === "PUBLISHED"
      ? ["report.generated", "report.published"]
      : ["report.generated"]) {
      const existingReportAudit = await prisma.auditLog.findFirst({
        where: { action, entityType: "Report", entityId: report.id },
      });
      if (!existingReportAudit) {
        await prisma.auditLog.create({
          data: {
            userId: admin.id,
            action,
            entityType: "Report",
            entityId: report.id,
            newValues: { seed: true, reportNumber, status: route.reportStatus },
          },
        });
      }
    }
    await prisma.notification.create({
      data: {
        userId: inventory.order.customerId ? (await prisma.customerProfile.findUnique({ where: { id: inventory.order.customerId } }))?.userId ?? admin.id : admin.id,
        type: route.reportStatus === "PUBLISHED" ? "REPORT_PUBLISHED" : "REPORT_AVAILABLE",
        title: route.reportStatus === "PUBLISHED" ? "Bericht veroeffentlicht" : "Bericht vorbereitet",
        message: `Seed-Bericht ${reportNumber} für ${inventory.order.orderNumber}.`,
      },
    });
  }
  for (const action of ["tour.review_opened", route.status === "APPROVED" ? "tour.approved" : route.status === "REJECTED" ? "tour.rejected" : "tour.needs_clarification"]) {
    const existing = await prisma.auditLog.findFirst({ where: { action, entityType: "DistributionTour", entityId: tour.id } });
    if (!existing) {
      await prisma.auditLog.create({
        data: {
          userId: admin.id,
          action,
          entityType: "DistributionTour",
          entityId: tour.id,
          newValues: { seed: true, flags: route.flags },
        },
      });
    }
  }
}

const dispatchOrderSeed = [
  ["DEMO-DISP-0001", "Koblenz", "56070", "Metternich Express", 2400],
  ["DEMO-DISP-0002", "Neuwied", "56564", "Heddesdorf Nord", 3600],
  ["DEMO-DISP-0003", "Bendorf", "56170", "Sayn Zentrum", 7200],
  ["DEMO-DISP-0004", "Lahnstein", "56112", "Innenstadt Sued", 2100],
  ["DEMO-DISP-0005", "Andernach", "56626", "Andernach Mitte", 4800],
  ["DEMO-DISP-0006", "Vallendar", "56179", "Uni-Umfeld", 5800],
  ["DEMO-DISP-0007", "Mülheim-Kärlich", "56218", "Industriepark", 9300],
  ["DEMO-DISP-0008", "Urmitz", "56220", "Rheinstrasse", 3100],
];

const dispatchInventories = [];
for (let index = 0; index < dispatchOrderSeed.length; index += 1) {
  const [orderNumber, city, postalCode, area, flyerQuantity] = dispatchOrderSeed[index];
  const customer = customers[(index + 1) % customers.length];
  const price = await calculateSeedPrice(flyerQuantity);
  const start = new Date();
  start.setDate(start.getDate() + index + 3);
  const end = new Date(start);
  end.setDate(end.getDate() + 5);

  const order = await prisma.order.upsert({
    where: { orderNumber },
    update: { status: "READY_FOR_PICKUP" },
    create: {
      orderNumber,
      customerId: customer.id,
      status: "READY_FOR_PICKUP",
      serviceType: "FLYER_DISTRIBUTION",
      city,
      postalCode,
      targetAddress: {
        street: "Dispatch-Strasse",
        houseNumber: String(index + 20),
        postalCode,
        city,
        country: "DE",
      },
      targetAreaName: area,
      targetAreaGeoJson: null,
      estimatedHouseholds: Math.round(flyerQuantity * 0.8),
      flyerQuantity,
      customerOwnFlyers: true,
      needsPrintService: false,
      preferredStartDate: start,
      preferredEndDate: end,
      flexibleScheduling: true,
      notes: "Demoauftrag für Modul 7 Disposition.",
      contactPerson: customer.contactName,
      contactPhone: customer.phone,
      calculatedNetPrice: price.net,
      calculatedVat: price.vat,
      calculatedGrossPrice: price.gross,
      priceRuleSnapshot: price.snapshot,
    },
  });

  const location = warehouseLocations[(index + 12) % warehouseLocations.length];
  const inventory = await prisma.warehouseInventory.upsert({
    where: { orderId: order.id },
    update: {
      warehouseLocationId: location.id,
      status: "READY_FOR_PICKUP",
      pickupStatus: "PREPARED",
      reservedDistributorId: null,
      expectedFlyers: flyerQuantity,
      receivedFlyers: flyerQuantity,
      remainingFlyers: flyerQuantity,
      preparedAt: new Date(),
    },
    create: {
      orderId: order.id,
      warehouseLocationId: location.id,
      status: "READY_FOR_PICKUP",
      remainingStockStatus: "NOT_RELEVANT",
      qrCode: `pending-dispatch-${order.id}`,
      pickupToken: randomBytes(24).toString("base64url"),
      cartonCount: index + 3,
      expectedFlyers: flyerQuantity,
      receivedFlyers: flyerQuantity,
      remainingFlyers: flyerQuantity,
      damagedFlyers: 0,
      pickupStatus: "PREPARED",
      preparedAt: new Date(),
      receivedAt: new Date(),
      notes: "Seed-Lagerbestand für Modul 7.",
    },
  });
  const qrCode = JSON.stringify({ orderNumber: order.orderNumber, warehouseId: warehouse.id, inventoryId: inventory.id });
  const updatedInventory = await prisma.warehouseInventory.update({
    where: { id: inventory.id },
    data: {
      qrCode,
      qrCodePngDataUrl: await QRCode.toDataURL(qrCode, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 420,
      }),
    },
    include: { order: true },
  });

  dispatchInventories.push(updatedInventory);
}

await prisma.dispatchAssignment.deleteMany({
  where: { order: { orderNumber: { startsWith: "DEMO-DISP-" } } },
});

const dispatchDistributorA = approvedDistributors.find((profile) => profile.firstName === "Nadine") ?? approvedDistributors[0];
const dispatchDistributorB = approvedDistributors.find((profile) => profile.firstName === "Clara") ?? approvedDistributors[1];
const dispatchDistributorC = approvedDistributors.find((profile) => profile.firstName === "Mehmet") ?? approvedDistributors[2];

const acceptedInventory = dispatchInventories[0];
const rejectedInventory = dispatchInventories[1];
const assignedInventory = dispatchInventories[2];

const acceptedAssignment = await prisma.dispatchAssignment.create({
  data: {
    orderId: acceptedInventory.orderId,
    inventoryId: acceptedInventory.id,
    distributorId: dispatchDistributorA.id,
    assignedBy: admin.id,
    status: "ACCEPTED",
    capacityWarning: false,
    recommendationScore: 111,
    distanceMeters: 3000,
    acceptedAt: new Date(),
  },
});
await prisma.order.update({
  where: { id: acceptedInventory.orderId },
  data: { assignedDistributorId: dispatchDistributorA.id },
});
await prisma.warehouseInventory.update({
  where: { id: acceptedInventory.id },
  data: { reservedDistributorId: dispatchDistributorA.id, pickupStatus: "RESERVED" },
});
await prisma.distributionTour.upsert({
  where: { id: "demo-dispatch-tour-accepted" },
  update: {
    orderId: acceptedInventory.orderId,
    inventoryId: acceptedInventory.id,
    distributorId: dispatchDistributorA.id,
    status: "READY",
  },
  create: {
    id: "demo-dispatch-tour-accepted",
    orderId: acceptedInventory.orderId,
    inventoryId: acceptedInventory.id,
    distributorId: dispatchDistributorA.id,
    status: "READY",
  },
});

const rejectedAssignment = await prisma.dispatchAssignment.create({
  data: {
    orderId: rejectedInventory.orderId,
    inventoryId: rejectedInventory.id,
    distributorId: dispatchDistributorB.id,
    assignedBy: admin.id,
    status: "REJECTED",
    rejectionReason: "ZU_WEIT",
    rejectionNote: "Seed: Route ist heute zu weit entfernt.",
    capacityWarning: false,
    recommendationScore: 88,
    distanceMeters: 18000,
    rejectedAt: new Date(),
  },
});

const assignedAssignment = await prisma.dispatchAssignment.create({
  data: {
    orderId: assignedInventory.orderId,
    inventoryId: assignedInventory.id,
    distributorId: dispatchDistributorC.id,
    assignedBy: admin.id,
    status: "ASSIGNED",
    capacityWarning: true,
    recommendationScore: 73,
    distanceMeters: 16000,
  },
});
await prisma.order.update({
  where: { id: assignedInventory.orderId },
  data: { assignedDistributorId: dispatchDistributorC.id },
});
await prisma.warehouseInventory.update({
  where: { id: assignedInventory.id },
  data: { reservedDistributorId: dispatchDistributorC.id, pickupStatus: "RESERVED" },
});
await prisma.distributionTour.upsert({
  where: { id: "demo-dispatch-tour-assigned" },
  update: {
    orderId: assignedInventory.orderId,
    inventoryId: assignedInventory.id,
    distributorId: dispatchDistributorC.id,
    status: "ASSIGNED",
  },
  create: {
    id: "demo-dispatch-tour-assigned",
    orderId: assignedInventory.orderId,
    inventoryId: assignedInventory.id,
    distributorId: dispatchDistributorC.id,
    status: "ASSIGNED",
  },
});

for (const entry of [
  ["dispatch.assigned", acceptedAssignment.id, dispatchDistributorA.id, acceptedInventory.order.orderNumber],
  ["dispatch.accepted", acceptedAssignment.id, dispatchDistributorA.id, acceptedInventory.order.orderNumber],
  ["dispatch.rejected", rejectedAssignment.id, dispatchDistributorB.id, rejectedInventory.order.orderNumber],
  ["dispatch.unassigned", rejectedInventory.orderId, dispatchDistributorB.id, rejectedInventory.order.orderNumber],
  ["dispatch.assigned", assignedAssignment.id, dispatchDistributorC.id, assignedInventory.order.orderNumber],
]) {
  const [action, entityId, distributorId, orderNumber] = entry;
  await prisma.auditLog.create({
    data: {
      userId: action === "dispatch.accepted" || action === "dispatch.rejected"
        ? (await prisma.distributorProfile.findUnique({ where: { id: distributorId }, select: { userId: true } }))?.userId
        : admin.id,
      action,
      entityType: action === "dispatch.unassigned" ? "Order" : "DispatchAssignment",
      entityId,
      newValues: { seed: true, orderNumber, distributorId },
    },
  });
}

await prisma.notification.createMany({
  data: [
    {
      userId: dispatchDistributorC.userId,
      type: "DISPATCH_NEW_ORDER",
      title: "Neuer Auftrag",
      message: `Auftrag ${assignedInventory.order.orderNumber} wartet auf deine Annahme.`,
    },
    {
      userId: admin.id,
      type: "DISPATCH_REJECTED",
      title: "Auftrag abgelehnt",
      message: `${dispatchDistributorB.firstName} ${dispatchDistributorB.lastName} hat ${rejectedInventory.order.orderNumber} abgelehnt.`,
    },
    {
      userId: admin.id,
      type: "DISPATCH_CAPACITY_EXCEEDED",
      title: "Kapazität überschritten",
      message: `${dispatchDistributorC.firstName} ${dispatchDistributorC.lastName}: Seed-Auftrag überschreitet die Kapazität.`,
    },
  ],
});

const recommendationOrders = dispatchInventories.slice(0, 4);
const recommendationDistributors = [dispatchDistributorA, dispatchDistributorB, dispatchDistributorC].filter(Boolean);
for (let orderIndex = 0; orderIndex < recommendationOrders.length; orderIndex += 1) {
  const inventory = recommendationOrders[orderIndex];
  for (let distributorIndex = 0; distributorIndex < recommendationDistributors.length; distributorIndex += 1) {
    const distributor = recommendationDistributors[distributorIndex];
    const score = Math.max(25, 95 - orderIndex * 9 - distributorIndex * 17);
    const status = orderIndex === 0 && distributorIndex === 0
      ? "SELECTED"
      : orderIndex === 1 && distributorIndex === 1
        ? "DISMISSED"
        : "SUGGESTED";
    await prisma.autoDispatchRecommendation.upsert({
      where: {
        orderId_distributorId: {
          orderId: inventory.orderId,
          distributorId: distributor.id,
        },
      },
      update: {
        score,
        status,
        reasons: ["Seed: freigegeben", distributorIndex === 0 ? "Seed: Einsatzgebiet passt" : "Seed: Kapazität verfügbar"],
        warnings: distributorIndex === 2 ? ["Seed: Kapazitätswarnung", "Seed: offene Touren"] : [],
      },
      create: {
        orderId: inventory.orderId,
        distributorId: distributor.id,
        score,
        status,
        reasons: ["Seed: freigegeben", distributorIndex === 0 ? "Seed: Einsatzgebiet passt" : "Seed: Kapazität verfügbar"],
        warnings: distributorIndex === 2 ? ["Seed: Kapazitätswarnung", "Seed: offene Touren"] : [],
      },
    });
  }
}

for (const action of [
  "dispatch.recommendation_created",
  "dispatch.recommendation_selected",
  "dispatch.recommendation_dismissed",
  "dispatch.auto_assigned",
  "dispatch.auto_assign_skipped",
]) {
  const existing = await prisma.auditLog.findFirst({ where: { action } });
  if (!existing) {
    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action,
        entityType: action === "dispatch.auto_assigned" ? "DispatchAssignment" : "AutoDispatchRecommendation",
        entityId: "seed-auto-dispatch",
        newValues: { seed: true, module: 14 },
      },
    });
  }
}

await prisma.notification.createMany({
  data: [
    {
      userId: admin.id,
      type: "DISPATCH_RECOMMENDATIONS_CREATED",
      title: "Empfehlungen erstellt",
      message: "Seed: Auto-Dispatch-Empfehlungen wurden erzeugt.",
    },
    {
      userId: admin.id,
      type: "DISPATCH_AUTO_ASSIGNED",
      title: "Auto-Dispatch zugewiesen",
      message: "Seed: Auto-Dispatch hat eine Beispielzuweisung erzeugt.",
    },
    {
      userId: admin.id,
      type: "DISPATCH_AUTO_ASSIGN_SKIPPED",
      title: "Auto-Dispatch übersprungen",
      message: "Seed: Auto-Dispatch wurde wegen MinScore übersprungen.",
    },
    {
      userId: dispatchDistributorA.userId,
      type: "DISPATCH_AUTO_ASSIGNED_ORDER",
      title: "Neuer Auftrag durch Auto-Dispatch",
      message: "Seed: Neuer Auftrag durch Auto-Dispatch.",
    },
  ],
});

function areaSlug(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function polygonGeoJson(centerLng, centerLat, offset) {
  const ring = [
    [centerLng - offset, centerLat - offset],
    [centerLng + offset, centerLat - offset],
    [centerLng + offset, centerLat + offset],
    [centerLng - offset, centerLat + offset],
    [centerLng - offset, centerLat - offset],
  ];
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { seed: true },
        geometry: { type: "Polygon", coordinates: [ring] },
      },
    ],
  };
}

const areaSeed = [
  ["Koblenz Metternich", "DISTRICT", "Koblenz", "56072", "Metternich", 2450, 2646, 7200, 50.371, 7.559, 950],
  ["Koblenz Guels", "DISTRICT", "Koblenz", "56072", "Guels", 1800, 1944, 5400, 50.353, 7.514, 850],
  ["Karthause", "DISTRICT", "Koblenz", "56075", "Karthause", 3100, 3348, 8600, 50.334, 7.573, 900],
  ["56072", "POSTAL_CODE", "Koblenz", "56072", null, 5100, 5508, 12400, 50.363, 7.539, 1200],
  ["56068 Koblenz Zentrum", "POSTAL_CODE", "Koblenz", "56068", "Zentrum", 6200, 6696, 14100, 50.360, 7.598, 1100],
  ["Neuwied Innenstadt", "DISTRICT", "Neuwied", "56564", "Innenstadt", 4300, 4644, 9800, 50.430, 7.461, 1000],
  ["Bendorf Sayn", "DISTRICT", "Bendorf", "56170", "Sayn", 1500, 1620, 4100, 50.437, 7.575, 700],
  ["Andernach Mitte", "DISTRICT", "Andernach", "56626", "Mitte", 3900, 4212, 9100, 50.438, 7.401, 980],
  ["Lahnstein Oberlahnstein", "DISTRICT", "Lahnstein", "56112", "Oberlahnstein", 2800, 3024, 7600, 50.300, 7.607, 820],
  ["Vallendar Rheinufer", "POLYGON", "Vallendar", "56179", "Rheinufer", 1200, 1296, 3600, 50.398, 7.615, 650],
  ["Mülheim-Kärlich Gewerbegebiet", "POLYGON", "Mülheim-Kärlich", "56218", "Gewerbegebiet", 900, 972, 5200, 50.386, 7.492, 900],
  ["Urmitz Bahnhof", "POLYGON", "Urmitz", "56220", "Bahnhof", 1100, 1188, 3300, 50.417, 7.518, 650],
  ["Weissenthurm Mitte", "CITY", "Weissenthurm", "56575", null, 2400, 2592, 6800, 50.417, 7.462, 850],
  ["Plaidt Nord", "DISTRICT", "Plaidt", "56637", "Nord", 1700, 1836, 4500, 50.395, 7.390, 700],
  ["Koblenz Radius 1km Zentrum", "RADIUS", "Koblenz", "56068", "Zentrum", 3600, 3888, 9000, 50.359, 7.597, 1000],
  ["Neuwied Radius 1.5km", "RADIUS", "Neuwied", "56564", null, 5200, 5616, 12500, 50.431, 7.466, 1500],
  ["Koblenz Altstadt Polygon", "POLYGON", "Koblenz", "56068", "Altstadt", 2600, 2808, 6400, 50.361, 7.597, 500],
  ["Koblenz Sued Polygon", "POLYGON", "Koblenz", "56068", "Sued", 2100, 2268, 5800, 50.345, 7.590, 550],
  ["Andernach Suedstadt Polygon", "POLYGON", "Andernach", "56626", "Suedstadt", 1900, 2052, 4900, 50.425, 7.405, 600],
  ["Lahnstein Radius 800m", "RADIUS", "Lahnstein", "56112", null, 2300, 2484, 6100, 50.302, 7.606, 800],
];

const seededAreas = [];
for (const [name, type, city, postalCode, district, households, flyers, distance, lat, lng, radius] of areaSeed) {
  const slug = areaSlug(name);
  const geoJson = ["POLYGON", "DISTRICT", "POSTAL_CODE", "CITY"].includes(type)
    ? polygonGeoJson(lng, lat, type === "POLYGON" ? 0.006 : 0.009)
    : null;
  const coverageAreaSqm = type === "RADIUS"
    ? Math.round(Math.PI * radius * radius)
    : Math.round((type === "POLYGON" ? 0.9 : 1.6) * 1_000_000);

  const area = await prisma.distributionArea.upsert({
    where: { slug },
    update: {
      name,
      type,
      status: "ACTIVE",
      reusable: true,
      city,
      postalCode,
      district,
      centerLat: new Prisma.Decimal(lat),
      centerLng: new Prisma.Decimal(lng),
      radiusMeters: type === "RADIUS" ? radius : null,
      geoJson,
      coverageAreaSqm: new Prisma.Decimal(coverageAreaSqm),
      estimatedHouseholds: households,
      estimatedFlyers: flyers,
      estimatedDistanceMeters: distance,
      createdById: admin.id,
    },
    create: {
      name,
      slug,
      type,
      status: "ACTIVE",
      reusable: true,
      city,
      postalCode,
      district,
      centerLat: new Prisma.Decimal(lat),
      centerLng: new Prisma.Decimal(lng),
      radiusMeters: type === "RADIUS" ? radius : null,
      geoJson,
      coverageAreaSqm: new Prisma.Decimal(coverageAreaSqm),
      estimatedHouseholds: households,
      estimatedFlyers: flyers,
      estimatedDistanceMeters: distance,
      createdById: admin.id,
    },
  });
  await prisma.areaPolygon.deleteMany({ where: { areaId: area.id } });
  if (geoJson) {
    await prisma.areaPolygon.create({
      data: {
        areaId: area.id,
        sortOrder: 0,
        geometry: geoJson.features[0],
        areaSqm: new Prisma.Decimal(coverageAreaSqm),
      },
    });
  }
  const existingEstimate = await prisma.areaHouseholdEstimate.findFirst({ where: { areaId: area.id, method: "SEED" } });
  if (!existingEstimate) {
    await prisma.areaHouseholdEstimate.create({
      data: {
        areaId: area.id,
        households,
        estimatedFlyers: flyers,
        distanceMeters: distance,
        coverageAreaSqm: new Prisma.Decimal(coverageAreaSqm),
        method: "SEED",
        source: "module8-seed",
        confidence: new Prisma.Decimal("0.700"),
        createdById: admin.id,
      },
    });
  }
  const existingHistory = await prisma.areaHistory.findFirst({ where: { areaId: area.id, action: "area.created" } });
  if (!existingHistory) {
    await prisma.areaHistory.create({
      data: {
        areaId: area.id,
        userId: admin.id,
        action: "area.created",
        newValue: { seed: true, name, type },
      },
    });
  }
  seededAreas.push(area);
}

const assignableOrders = await prisma.order.findMany({
  where: { orderNumber: { startsWith: "DEMO-ORD-" } },
  orderBy: { orderNumber: "asc" },
  take: 10,
});
for (let index = 0; index < assignableOrders.length; index += 1) {
  const order = assignableOrders[index];
  const area = seededAreas[index % seededAreas.length];
  await prisma.order.update({
    where: { id: order.id },
    data: {
      distributionAreaId: area.id,
      targetAreaName: area.name,
      targetAreaGeoJson: area.geoJson ?? undefined,
      city: area.city ?? order.city,
      postalCode: area.postalCode ?? order.postalCode,
      estimatedHouseholds: area.estimatedHouseholds,
      estimatedFlyers: area.estimatedFlyers,
      estimatedDistanceMeters: area.estimatedDistanceMeters,
      coverageAreaSqm: area.coverageAreaSqm,
    },
  });
  const existingAssignedHistory = await prisma.areaHistory.findFirst({
    where: { areaId: area.id, action: "area.assigned", newValue: { path: ["orderNumber"], equals: order.orderNumber } },
  });
  if (!existingAssignedHistory) {
    await prisma.areaHistory.create({
      data: {
        areaId: area.id,
        userId: admin.id,
        action: "area.assigned",
        newValue: { orderId: order.id, orderNumber: order.orderNumber },
      },
    });
  }
}

for (const action of ["area.created", "area.assigned"]) {
  const existing = await prisma.auditLog.findFirst({ where: { action, entityType: action === "area.assigned" ? "Order" : "DistributionArea" } });
  if (!existing) {
    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action,
        entityType: action === "area.assigned" ? "Order" : "DistributionArea",
        entityId: action === "area.assigned" ? assignableOrders[0]?.id ?? "seed-area-assigned" : seededAreas[0]?.id ?? "seed-area",
        newValues: { seed: true, count: seededAreas.length },
      },
    });
  }
}

await prisma.auditLog.create({
  data: {
    userId: admin.id,
    action: "seed.module2_created",
    entityType: "Seed",
    entityId: "module2",
    newValues: {
      customers: customerSeed.length,
      distributors: distributorSeed.length,
      admins: 1,
      orders: orderSeed.length,
      warehouseUsers: 1,
      warehouses: 1,
      warehouseLocations: locationSeed.length,
      warehouseInventories: warehouseOrderSeed.length,
      dispatchOrders: dispatchOrderSeed.length,
      dispatchAssignments: 3,
      distributionAreas: areaSeed.length,
      tours: tourInventory.length,
    },
  },
});

for (const [action, entityType, entityId] of [
  ["settings.company_updated", "CompanySettings", "seed-company-settings"],
  ["settings.branding_updated", "BrandingSettings", "seed-branding-settings"],
  ["settings.numbering_updated", "NumberingSettings", "seed-numbering-settings"],
  ["settings.pricing_updated", "Pricing", "pricing"],
  ["settings.warehouse_created", "Warehouse", "demo-zweitlager-neuwied"],
  ["settings.warehouse_updated", "Warehouse", "demo-hauptlager-koblenz"],
  ["settings.user_status_changed", "User", disabledWarehouseStaff.id],
]) {
  const existing = await prisma.auditLog.findFirst({ where: { action, entityType, entityId } });
  if (!existing) {
    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action,
        entityType,
        entityId,
        newValues: { seed: true, module: 12 },
      },
    });
  }
}

await prisma.notification.createMany({
  data: [
    {
      userId: admin.id,
      type: "SETTINGS_CHANGED",
      title: "Einstellungen geaendert",
      message: "Seed: Firmeneinstellungen und Branding wurden vorbereitet.",
    },
    {
      userId: admin.id,
      type: "PRICING_CHANGED",
      title: "Preisregel geaendert",
      message: "Seed: Preisregeln für Modul 12 sind aktiv.",
    },
    {
      userId: admin.id,
      type: "WAREHOUSE_CHANGED",
      title: "Lager geaendert",
      message: "Seed: Zwei Lagerstandorte wurden vorbereitet.",
    },
    {
      userId: admin.id,
      type: "INTERNAL_USER_DISABLED",
      title: "Interner Benutzer deaktiviert",
      message: `${disabledWarehouseStaff.email} ist als deaktivierter Demo-Benutzer vorhanden.`,
    },
  ],
});

await mkdir(accountingOutputDir, { recursive: true });
const seedInvoices = await prisma.invoice.findMany({ orderBy: { invoiceNumber: "asc" }, take: 5 });
const seedPayments = await prisma.payment.findMany({ orderBy: { createdAt: "asc" }, take: 5 });
const seedCreditNotes = await prisma.creditNote.findMany({ orderBy: { createdAt: "asc" }, take: 3 });
const accountingSeed = [
  ["ACC-SEED-0001", "INVOICES", "CSV_LEXWARE", "COMPLETED", seedInvoices.map((invoice) => ["Invoice", invoice.id])],
  ["ACC-SEED-0002", "PAYMENTS", "CSV_GENERIC", "COMPLETED", seedPayments.map((payment) => ["Payment", payment.id])],
  ["ACC-SEED-0003", "CREDIT_NOTES", "CSV_DATEV", "COMPLETED", seedCreditNotes.map((creditNote) => ["CreditNote", creditNote.id])],
  ["ACC-SEED-0004", "FULL_ACCOUNTING", "CSV_LEXWARE", "ARCHIVED", [...seedInvoices.slice(0, 2).map((invoice) => ["Invoice", invoice.id]), ...seedPayments.slice(0, 2).map((payment) => ["Payment", payment.id])]],
  ["ACC-SEED-0005", "FULL_ACCOUNTING", "CSV_DATEV", "FAILED", []],
];

for (const [exportNumber, type, format, status, rows] of accountingSeed) {
  const csvText = [
    "Typ;ID;Exportnummer",
    ...rows.map(([entityType, entityId]) => `${entityType};${entityId};${exportNumber}`),
  ].join("\r\n") + "\r\n";
  const fileName = `flyero-accounting-export-${exportNumber}.csv`;
  const filePath = path.join(accountingOutputDir, fileName);
  await writeFile(filePath, csvText, "utf8");
  const checksum = createHash("sha256").update(csvText).digest("hex");
  const accountingExport = await prisma.accountingExport.upsert({
    where: { exportNumber },
    update: {
      type,
      format,
      status,
      fileUrl: status === "FAILED" ? null : `/private/generated/accounting/${fileName}`,
      rowCount: rows.length,
      checksum: status === "FAILED" ? null : checksum,
      completedAt: status === "FAILED" ? new Date() : new Date(),
    },
    create: {
      exportNumber,
      type,
      format,
      status,
      periodStart: new Date(new Date().getFullYear(), 0, 1),
      periodEnd: new Date(),
      createdById: admin.id,
      fileUrl: status === "FAILED" ? null : `/private/generated/accounting/${fileName}`,
      rowCount: rows.length,
      checksum: status === "FAILED" ? null : checksum,
      completedAt: new Date(),
    },
  });
  await prisma.accountingExportItem.deleteMany({ where: { exportId: accountingExport.id } });
  if (rows.length) {
    await prisma.accountingExportItem.createMany({
      data: rows.map(([entityType, entityId]) => ({
        exportId: accountingExport.id,
        entityType,
        entityId,
        status: "EXPORTED",
      })),
    });
  }
}

for (const action of ["accounting.export_created", "accounting.export_completed", "accounting.export_failed", "accounting.export_downloaded", "accounting.export_archived"]) {
  const existing = await prisma.auditLog.findFirst({ where: { action, entityType: "AccountingExport" } });
  if (!existing) {
    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action,
        entityType: "AccountingExport",
        entityId: "ACC-SEED-0001",
        newValues: { seed: true, module: 13 },
      },
    });
  }
}

await prisma.notification.createMany({
  data: [
    {
      userId: admin.id,
      type: "ACCOUNTING_EXPORT_COMPLETED",
      title: "Export fertig",
      message: "Seed: Buchhaltungsexport wurde erstellt.",
    },
    {
      userId: admin.id,
      type: "ACCOUNTING_EXPORT_FAILED",
      title: "Export fehlgeschlagen",
      message: "Seed: Beispiel für fehlgeschlagenen Buchhaltungsexport.",
    },
  ],
});

const module15Templates = [
  ["CUSTOMER_REGISTERED", "CUSTOMER", "Kunde Registrierung", "Willkommen bei Flyero, {{customerName}}", "Hallo {{customerName}}, dein Konto für {{companyName}} wurde erstellt. Dein Dashboard: {{dashboardUrl}}"],
  ["CUSTOMER_VERIFY_EMAIL", "CUSTOMER", "Kunde E-Mail bestaetigen", "Bitte bestaetige deine E-Mail", "Hallo {{customerName}}, bestaetige deine E-Mail und oeffne danach {{dashboardUrl}}."],
  ["CUSTOMER_ORDER_CREATED", "CUSTOMER", "Auftrag erstellt", "Auftrag {{orderNumber}} wurde erstellt", "Hallo {{customerName}}, dein Auftrag {{orderNumber}} wurde angelegt."],
  ["CUSTOMER_PAYMENT_SUCCESS", "CUSTOMER", "Zahlung erfolgreich", "Zahlung für {{orderNumber}} erhalten", "Wir haben {{paymentAmount}} für Auftrag {{orderNumber}} erhalten."],
  ["CUSTOMER_PAYMENT_FAILED", "CUSTOMER", "Zahlung fehlgeschlagen", "Zahlung für {{orderNumber}} fehlgeschlagen", "Bitte prüfe deine Zahlung für Auftrag {{orderNumber}} im Dashboard {{dashboardUrl}}."],
  ["CUSTOMER_ORDER_APPROVED", "CUSTOMER", "Auftrag genehmigt", "Auftrag {{orderNumber}} wurde genehmigt", "Dein Auftrag {{orderNumber}} wurde genehmigt. Tracking: {{trackingUrl}}"],
  ["CUSTOMER_ORDER_REJECTED", "CUSTOMER", "Auftrag abgelehnt", "Rueckfrage zu Auftrag {{orderNumber}}", "Zu Auftrag {{orderNumber}} gibt es eine Rueckfrage. Support: {{supportEmail}}"],
  ["CUSTOMER_SEND_FLYERS", "CUSTOMER", "Flyer einsenden", "Flyer für {{orderNumber}} einsenden", "Bitte sende die Flyer für Auftrag {{orderNumber}} an unser Lager."],
  ["CUSTOMER_REPORT_AVAILABLE", "CUSTOMER", "Bericht verfügbar", "Bericht {{reportNumber}} ist verfügbar", "Der Bericht {{reportNumber}} für Auftrag {{orderNumber}} ist im Dashboard verfügbar."],
  ["CUSTOMER_INVOICE_AVAILABLE", "CUSTOMER", "Rechnung verfügbar", "Rechnung {{invoiceNumber}} ist verfügbar", "Deine Rechnung {{invoiceNumber}} steht im Dashboard {{dashboardUrl}} bereit."],
  ["DISTRIBUTOR_REGISTERED", "DISTRIBUTOR", "Verteiler Registrierung", "Willkommen bei Flyero", "Hallo {{customerName}}, dein Verteilerprofil wurde registriert."],
  ["DISTRIBUTOR_APPROVED", "DISTRIBUTOR", "Verteiler Freigabe", "Dein Profil wurde freigegeben", "Du kannst jetzt Touren im Dashboard {{dashboardUrl}} annehmen."],
  ["DISTRIBUTOR_NEW_TOUR", "DISTRIBUTOR", "Neue Tour", "Neue Tour für Auftrag {{orderNumber}}", "Eine neue Tour für Auftrag {{orderNumber}} wartet auf dich."],
  ["DISTRIBUTOR_TOUR_CHANGED", "DISTRIBUTOR", "Tour geaendert", "Tour zu {{orderNumber}} wurde geaendert", "Bitte prüfe die aktualisierte Tour im Dashboard {{dashboardUrl}}."],
  ["DISTRIBUTOR_TOUR_CANCELLED", "DISTRIBUTOR", "Tour storniert", "Tour zu {{orderNumber}} wurde storniert", "Die Tour zu Auftrag {{orderNumber}} wurde storniert."],
  ["DISTRIBUTOR_REMINDER", "DISTRIBUTOR", "Erinnerung", "Erinnerung für Auftrag {{orderNumber}}", "Bitte prüfe deine naechste Aktion für Auftrag {{orderNumber}}."],
  ["ADMIN_NEW_ORDER", "ADMIN", "Admin neuer Auftrag", "Neuer Auftrag {{orderNumber}}", "{{companyName}} hat Auftrag {{orderNumber}} erstellt."],
  ["ADMIN_PAYMENT_RECEIVED", "ADMIN", "Admin Zahlung eingegangen", "Zahlung eingegangen", "{{paymentAmount}} für Auftrag {{orderNumber}} wurden bezahlt."],
  ["ADMIN_AUTO_DISPATCH", "ADMIN", "Admin Auto-Dispatch", "Auto-Dispatch für {{orderNumber}}", "Auto-Dispatch wurde für Auftrag {{orderNumber}} vorbereitet."],
  ["ADMIN_REPORT_GENERATED", "ADMIN", "Admin Bericht erzeugt", "Bericht {{reportNumber}} erzeugt", "Bericht {{reportNumber}} für Auftrag {{orderNumber}} wurde erzeugt."],
  ["ADMIN_ERROR", "ADMIN", "Admin Fehler", "Fehler bei {{orderNumber}}", "Bei Auftrag {{orderNumber}} ist ein Fehler aufgetreten. Support: {{supportEmail}}"],
];

for (const [key, audience, name, subject, body] of module15Templates) {
  const placeholders = [...new Set([...subject.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g), ...body.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((match) => match[1]))];
  await prisma.notificationTemplate.upsert({
    where: { key },
    update: {
      audience,
      channel: "EMAIL",
      name,
      description: `Seed-Vorlage für Modul 15: ${name}`,
      subject,
      body,
      placeholders,
      isActive: true,
    },
    create: {
      key,
      audience,
      channel: "EMAIL",
      name,
      description: `Seed-Vorlage für Modul 15: ${name}`,
      subject,
      body,
      placeholders,
      isActive: true,
    },
  });
}

const module15Users = await prisma.user.findMany({
  where: { role: { in: ["CUSTOMER", "DISTRIBUTOR", "ADMIN", "SUPPORT_DISPATCHER"] } },
  orderBy: { createdAt: "asc" },
});
const module15TemplateRows = await prisma.notificationTemplate.findMany({ orderBy: { key: "asc" } });
const queueStatuses = ["PENDING", "SENDING", "SENT", "FAILED", "RETRY"];

for (const user of module15Users.slice(0, 12)) {
  for (const type of ["CUSTOMER_ORDER_CREATED", "CUSTOMER_REPORT_AVAILABLE", "DISTRIBUTOR_NEW_TOUR", "ADMIN_AUTO_DISPATCH"]) {
    await prisma.notificationPreference.upsert({
      where: { userId_type_channel: { userId: user.id, type, channel: "EMAIL" } },
      update: { enabled: type !== "ADMIN_AUTO_DISPATCH" || user.role !== "CUSTOMER" },
      create: { userId: user.id, type, channel: "EMAIL", enabled: type !== "ADMIN_AUTO_DISPATCH" || user.role !== "CUSTOMER" },
    });
  }
}

for (let index = 0; index < 60; index += 1) {
  const user = module15Users[index % module15Users.length];
  const template = module15TemplateRows[index % module15TemplateRows.length];
  const orderNumber = `M15-${String(index + 1).padStart(4, "0")}`;
  const data = {
    customerName: user.email.split("@")[0],
    companyName: "Flyero Demo",
    orderNumber,
    invoiceNumber: `RE-M15-${String(index + 1).padStart(4, "0")}`,
    reportNumber: `RPT-M15-${String(index + 1).padStart(4, "0")}`,
    paymentAmount: `${(250 + index * 7).toFixed(2)} EUR`,
    trackingUrl: `http://localhost:3000/customer/orders/${orderNumber}`,
    dashboardUrl: "http://localhost:3000/customer/dashboard",
    supportEmail: "support@flyero.local",
  };
  const render = (text) => text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => data[key] ?? "");
  const message = await prisma.notificationMessage.create({
    data: {
      userId: user.id,
      templateId: template.id,
      type: template.key,
      audience: template.audience,
      channel: "IN_APP",
      subject: render(template.subject),
      body: render(template.body),
      data,
      readAt: index % 3 === 0 ? new Date() : null,
    },
  });
  await prisma.notification.create({
    data: {
      userId: user.id,
      type: template.key,
      title: message.subject,
      message: message.body,
      readAt: message.readAt,
    },
  });
  const status = queueStatuses[index % queueStatuses.length];
  const queue = await prisma.notificationQueue.create({
    data: {
      messageId: message.id,
      templateId: template.id,
      userId: user.id,
      channel: "EMAIL",
      status,
      attempts: status === "FAILED" || status === "RETRY" ? 1 : 0,
      sentAt: status === "SENT" ? new Date() : null,
      failedAt: status === "FAILED" ? new Date() : null,
      lastError: status === "FAILED" ? "Seed: SMTP-Provider nicht konfiguriert." : null,
      payload: { subject: message.subject, body: message.body, data },
    },
  });
  await prisma.notificationLog.create({
    data: {
      messageId: message.id,
      queueId: queue.id,
      templateId: template.id,
      userId: user.id,
      action: index % 5 === 2 ? "notification.sent" : index % 5 === 3 ? "notification.failed" : "notification.created",
      status,
      detail: "Seed-Log für Modul 15 Kommunikationsplattform.",
      metadata: { module: 15, index },
    },
  });
}

for (const action of ["notification.created", "notification.sent", "notification.failed", "template.updated", "template.previewed"]) {
  const existing = await prisma.auditLog.findFirst({ where: { action, entityType: { in: ["NotificationMessage", "NotificationQueue", "NotificationTemplate"] } } });
  if (!existing) {
    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action,
        entityType: action.startsWith("template.") ? "NotificationTemplate" : action === "notification.created" ? "NotificationMessage" : "NotificationQueue",
        entityId: "MODULE15-SEED",
        newValues: { seed: true, module: 15 },
      },
    });
  }
}

await prisma.lead.deleteMany({ where: { source: "seed:module16" } });
await prisma.lead.createMany({
  data: [
    ["CUSTOMER", "Anna Schneider", "Rhein-Mosel Immobilien GmbH", "anna.schneider@example.com", "+49 261 200001", "Koblenz", "Wir planen eine Immobilienkampagne für mehrere Stadtteile.", "NEW"],
    ["CUSTOMER", "Markus Weber", "Autohaus Mittelrhein KG", "markus.weber@example.com", "+49 2631 200002", "Neuwied", "Bitte Angebot für 6.000 Flyer mit GPS-Nachweis.", "CONTACTED"],
    ["CUSTOMER", "Sarah Klein", "PflegePlus Lahnstein", "sarah.klein@example.com", "+49 2621 200003", "Lahnstein", "Wir moechten eine lokale Recruiting-Aktion bewerben.", "QUALIFIED"],
    ["CUSTOMER", "David Braun", "Fitwerk Koblenz", "david.braun@example.com", "+49 261 200004", "Koblenz", "Interesse an regelmaessiger Studio-Werbung.", "WON"],
    ["CUSTOMER", "Miriam Schulz", "Restaurant Hafenblick", "miriam.schulz@example.com", "+49 2632 200005", "Andernach", "Flyer für neue Mittagskarte in Andernach.", "NEW"],
    ["CUSTOMER", "Timo Beck", "Elektro Beck", "timo.beck@example.com", "+49 2622 200006", "Bendorf", "Haushaltsverteilung für Handwerksleistungen.", "CONTACTED"],
    ["CUSTOMER", "Laura Stein", "Concept Store Vallendar", "laura.stein@example.com", "+49 261 200007", "Vallendar", "Eroeffnungskampagne mit kurzem Zeitraum.", "QUALIFIED"],
    ["CUSTOMER", "Nina Reuter", "Eventverein Rhein", "nina.reuter@example.com", "+49 2631 200008", "Neuwied", "Flyer für Vereinsfest und Sponsorenlauf.", "LOST"],
    ["DISTRIBUTOR", "Leon Hartmann", null, "leon.lead@example.com", "+49 170 200009", "Koblenz", "Ich moechte als Verteiler am Wochenende arbeiten.", "NEW"],
    ["DISTRIBUTOR", "Mira Scholz", null, "mira.lead@example.com", "+49 171 200010", "Neuwied", "Ich habe ein Fahrrad und kann abends verteilen.", "CONTACTED"],
    ["DISTRIBUTOR", "Yasin Aydin", null, "yasin.lead@example.com", "+49 172 200011", "Bendorf", "Interesse an Touren in Bendorf und Vallendar.", "QUALIFIED"],
    ["DISTRIBUTOR", "Clara Fischer", null, "clara.lead@example.com", "+49 173 200012", "Lahnstein", "Bitte Infos zur Verteilerregistrierung.", "NEW"],
    ["PARTNER", "Julia Kramer", "Print Partner Koblenz", "julia.kramer@example.com", "+49 261 200013", "Koblenz", "Kooperation für Druck und Logistik möglich.", "CONTACTED"],
    ["PARTNER", "Felix Roth", "Medienhaus Mittelrhein", "felix.roth@example.com", "+49 2631 200014", "Neuwied", "Partnerschaft für regionale Kampagnen.", "QUALIFIED"],
    ["OTHER", "Svenja Maier", "Marketing Beratung Maier", "svenja.maier@example.com", "+49 2621 200015", "Lahnstein", "Frage zu Agenturzugang und Kundenverwaltung.", "NEW"],
    ["CUSTOMER", "Okan Yilmaz", "Pizza Kurier Bendorf", "okan.yilmaz@example.com", "+49 2622 200016", "Bendorf", "2.500 Flyer für Liefergebiet Bendorf.", "NEW"],
    ["CUSTOMER", "Helena Wolf", "Gebaeudeservice Wolf", "helena.wolf@example.com", "+49 261 200017", "Mülheim-Kärlich", "B2B-Flyer im Gewerbegebiet verteilen.", "CONTACTED"],
    ["CUSTOMER", "Patrick Jung", "Franchise Demo West", "patrick.jung@example.com", "+49 261 200018", "Koblenz", "Mehrere Standorte sollen vergleichbar reporten.", "QUALIFIED"],
    ["DISTRIBUTOR", "Nadine Krüger", null, "nadine.lead@example.com", "+49 174 200019", "Mülheim-Kärlich", "Ich kann tagsüber größere Touren übernehmen.", "WON"],
    ["OTHER", "Robert Kaiser", "Stadtteilinitiative", "robert.kaiser@example.com", "+49 2632 200020", "Andernach", "Allgemeine Frage zu Vereinen und Sonderkonditionen.", "LOST"],
  ].map(([type, name, companyName, email, phone, city, message, status]) => ({
    type,
    name,
    companyName,
    email,
    phone,
    city,
    message,
    status,
    source: "seed:module16",
    adminNote: status === "CONTACTED" ? "Seed: Erstkontakt vorbereitet." : null,
  })),
});

const existingLeadAudit = await prisma.auditLog.findFirst({ where: { action: "lead.created", entityType: "Lead", entityId: "MODULE16-SEED" } });
if (!existingLeadAudit) {
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "lead.created",
      entityType: "Lead",
      entityId: "MODULE16-SEED",
      newValues: { seed: true, module: 16, count: 20 },
    },
  });
}

await prisma.systemLog.deleteMany({ where: { source: { startsWith: "seed.module17" } } });
await prisma.errorLog.deleteMany({ where: { source: { startsWith: "seed.module17" } } });
await prisma.systemHealthCheck.deleteMany({ where: { metadata: { path: ["source"], equals: "seed.module17" } } });
await prisma.backgroundJobLog.deleteMany({ where: { metadata: { path: ["source"], equals: "seed.module17" } } });

const systemLevels = ["INFO", "WARNING", "ERROR", "CRITICAL"];
await prisma.systemLog.createMany({
  data: Array.from({ length: 30 }, (_value, index) => ({
    level: systemLevels[index % systemLevels.length],
    source: `seed.module17.${["api", "payment", "warehouse", "report", "notification"][index % 5]}`,
    message: `Seed SystemLog ${index + 1}: Betriebsereignis für Monitoring.`,
    metadata: { source: "seed.module17", module: 17, index },
    createdAt: new Date(Date.now() - index * 60 * 60 * 1000),
  })),
});

const errorStatuses = ["OPEN", "IN_PROGRESS", "RESOLVED", "IGNORED"];
const errorSeverities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
await prisma.errorLog.createMany({
  data: Array.from({ length: 20 }, (_value, index) => {
    const status = errorStatuses[index % errorStatuses.length];
    return {
      severity: errorSeverities[index % errorSeverities.length],
      source: `seed.module17.${["stripe", "pdf", "lead", "gps", "warehouse"][index % 5]}`,
      message: `Seed ErrorLog ${index + 1}: Beispielhafte Störung.`,
      stack: index % 3 === 0 ? `Error: Seed Fehler ${index + 1}\n    at seed.module17 (${index}:1)` : null,
      metadata: { source: "seed.module17", module: 17, index },
      status,
      resolvedById: status === "RESOLVED" || status === "IGNORED" ? admin.id : null,
      resolvedAt: status === "RESOLVED" || status === "IGNORED" ? new Date(Date.now() - index * 30 * 60 * 1000) : null,
      resolutionNote: status === "RESOLVED" ? "Seed: Problem geloest." : status === "IGNORED" ? "Seed: bewusst ignoriert." : null,
      createdAt: new Date(Date.now() - index * 2 * 60 * 60 * 1000),
    };
  }),
});

const healthStates = ["OK", "DEGRADED", "OK", "DOWN", "OK"];
await prisma.systemHealthCheck.createMany({
  data: Array.from({ length: 10 }, (_value, index) => {
    const status = healthStates[index % healthStates.length];
    return {
      status,
      databaseStatus: index === 3 ? "DOWN" : "OK",
      storageStatus: index % 4 === 0 ? "DEGRADED" : "OK",
      stripeStatus: index % 3 === 0 ? "DEGRADED" : "OK",
      googleMapsStatus: index % 5 === 0 ? "DEGRADED" : "OK",
      emailStatus: index % 2 === 0 ? "DEGRADED" : "OK",
      queueStatus: index % 4 === 2 ? "DEGRADED" : "OK",
      checkedAt: new Date(Date.now() - index * 3 * 60 * 60 * 1000),
      metadata: { source: "seed.module17", module: 17, index },
    };
  }),
});

const jobTypes = ["NOTIFICATION_QUEUE", "ACCOUNTING_EXPORT", "PDF_GENERATION", "STRIPE_WEBHOOK_PROCESSING", "REPORT_GENERATION"];
const jobStatuses = ["STARTED", "SUCCESS", "FAILED"];
await prisma.backgroundJobLog.createMany({
  data: Array.from({ length: 15 }, (_value, index) => {
    const status = jobStatuses[index % jobStatuses.length];
    const startedAt = new Date(Date.now() - index * 45 * 60 * 1000);
    const finishedAt = status === "STARTED" ? null : new Date(startedAt.getTime() + 35_000 + index * 1000);
    return {
      jobType: jobTypes[index % jobTypes.length],
      status,
      startedAt,
      finishedAt,
      durationMs: finishedAt ? finishedAt.getTime() - startedAt.getTime() : null,
      errorMessage: status === "FAILED" ? "Seed: Job fehlgeschlagen." : null,
      metadata: { source: "seed.module17", module: 17, index },
    };
  }),
});

for (const action of [
  "monitoring.health_checked",
  "monitoring.error_created",
  "monitoring.error_resolved",
  "monitoring.error_ignored",
  "monitoring.job_failed",
]) {
  const existing = await prisma.auditLog.findFirst({ where: { action, entityType: { in: ["SystemHealthCheck", "ErrorLog", "BackgroundJobLog"] } } });
  if (!existing) {
    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action,
        entityType: action === "monitoring.health_checked" ? "SystemHealthCheck" : action === "monitoring.job_failed" ? "BackgroundJobLog" : "ErrorLog",
        entityId: "MODULE17-SEED",
        newValues: { seed: true, module: 17 },
      },
    });
  }
}

await prisma.notification.createMany({
  data: [
    {
      userId: admin.id,
      type: "MONITORING_CRITICAL_ERROR",
      title: "Kritischer Fehler erkannt",
      message: "Seed: Kritischer Fehler für Monitoring-Demo.",
    },
    {
      userId: admin.id,
      type: "MONITORING_HEALTH_DEGRADED",
      title: "Health Status DEGRADED",
      message: "Seed: Systemstatus ist eingeschraenkt.",
    },
    {
      userId: admin.id,
      type: "MONITORING_HEALTH_DOWN",
      title: "Health Status DOWN",
      message: "Seed: Systemstatus ist down.",
    },
    {
      userId: admin.id,
      type: "MONITORING_ERROR_RESOLVED",
      title: "Fehler geloest",
      message: "Seed: Fehler wurde geloest.",
    },
  ],
});

await prisma.notificationQueue.deleteMany({ where: { payload: { path: ["source"], equals: "seed.module18" } } });
await prisma.notificationMessage.deleteMany({ where: { data: { path: ["source"], equals: "seed.module18" } } });

const module18Users = await prisma.user.findMany({
  where: { role: { in: ["CUSTOMER", "DISTRIBUTOR", "ADMIN", "SUPPORT_DISPATCHER"] } },
  orderBy: { createdAt: "asc" },
  take: 8,
});
const module18Template = await prisma.notificationTemplate.findFirst({ where: { channel: "EMAIL", isActive: true }, orderBy: { key: "asc" } });
const module18QueueStatuses = ["PENDING", "SENT", "FAILED", "RETRY"];

for (let index = 0; index < 16; index += 1) {
  const user = module18Users[index % module18Users.length];
  const status = module18QueueStatuses[index % module18QueueStatuses.length];
  const message = await prisma.notificationMessage.create({
    data: {
      userId: user.id,
      templateId: module18Template?.id,
      type: "MODULE18_EMAIL_QUEUE",
      audience: user.role === "CUSTOMER" ? "CUSTOMER" : user.role === "DISTRIBUTOR" ? "DISTRIBUTOR" : "ADMIN",
      channel: "IN_APP",
      subject: `Modul 18 Seed Mail ${index + 1}`,
      body: "Diese Seed-Nachricht prueft den echten E-Mail-Queue-Worker.",
      data: { source: "seed.module18", module: 18, index },
      readAt: index % 2 === 0 ? new Date() : null,
    },
  });
  const queue = await prisma.notificationQueue.create({
    data: {
      messageId: message.id,
      templateId: module18Template?.id,
      userId: user.id,
      channel: "EMAIL",
      status,
      attempts: status === "FAILED" ? 3 : status === "RETRY" ? 1 : 0,
      maxAttempts: 3,
      sentAt: status === "SENT" ? new Date() : null,
      failedAt: status === "FAILED" || status === "RETRY" ? new Date() : null,
      lastError: status === "FAILED" || status === "RETRY" ? "Seed: SMTP nicht erreichbar." : null,
      payload: {
        source: "seed.module18",
        subject: `Modul 18 Seed Mail ${index + 1}`,
        body: "Diese Seed-Nachricht prueft den echten E-Mail-Queue-Worker.",
        data: { module: 18, index },
      },
    },
  });
  await prisma.notificationLog.create({
    data: {
      messageId: message.id,
      queueId: queue.id,
      templateId: module18Template?.id,
      userId: user.id,
      action: status === "SENT" ? "email.sent" : status === "FAILED" ? "email.failed" : "notification.created",
      status,
      detail: "Seed-Log für Modul 18 E-Mail Queue.",
      metadata: { source: "seed.module18", module: 18, index },
    },
  });
}

await prisma.lead.deleteMany({ where: { source: "seed.module19" } });
await prisma.refund.deleteMany({ where: { reason: { startsWith: "Seed Modul 19" } } });

const monthAgo = (months, day = 8) => new Date(new Date().getFullYear(), new Date().getMonth() - months, day, 10, 0, 0);
const module19LeadStatuses = ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"];
const module19Cities = ["Koblenz", "Neuwied", "Bendorf", "Lahnstein", "Vallendar", "Andernach"];

for (let index = 0; index < 24; index += 1) {
  const createdAt = monthAgo(index % 8, 3 + (index % 20));
  await prisma.lead.create({
    data: {
      type: index % 5 === 0 ? "DISTRIBUTOR" : "CUSTOMER",
      name: `Analytics Lead ${index + 1}`,
      companyName: `FLYERO Analytics Firma ${index + 1}`,
      email: `analytics-lead-${index + 1}@example.com`,
      phone: `0261${String(500000 + index).padStart(6, "0")}`,
      city: module19Cities[index % module19Cities.length],
      message: "Seed Modul 19: Lead für Analytics-Auswertung.",
      status: module19LeadStatuses[index % module19LeadStatuses.length],
      source: "seed.module19",
      createdAt,
      updatedAt: createdAt,
    },
  });
}

const module19Orders = await prisma.order.findMany({
  include: {
    payments: true,
    tours: true,
    reports: true,
    warehouseInventory: true,
    dispatchAssignments: true,
  },
  orderBy: { orderNumber: "asc" },
  take: 28,
});

for (let index = 0; index < module19Orders.length; index += 1) {
  const order = module19Orders[index];
  const base = monthAgo(index % 9, 4 + (index % 18));
  const paidAt = new Date(base.getTime() + 8 * 60 * 60 * 1000);
  const warehouseAt = new Date(base.getTime() + 2 * 24 * 60 * 60 * 1000);
  const dispatchAt = new Date(base.getTime() + 3 * 24 * 60 * 60 * 1000);
  const tourStart = new Date(base.getTime() + 4 * 24 * 60 * 60 * 1000);
  const tourEnd = new Date(tourStart.getTime() + (90 + index * 7) * 60 * 1000);
  const reportAt = new Date(tourEnd.getTime() + (6 + (index % 5)) * 60 * 60 * 1000);

  await prisma.order.update({
    where: { id: order.id },
    data: {
      createdAt: base,
      updatedAt: reportAt,
      preferredStartDate: new Date(base.getTime() + 5 * 24 * 60 * 60 * 1000),
      preferredEndDate: new Date(base.getTime() + 12 * 24 * 60 * 60 * 1000),
    },
  });

  for (const payment of order.payments) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        createdAt: paidAt,
        updatedAt: paidAt,
        paidAt: ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"].includes(payment.status) ? paidAt : null,
        failedAt: payment.status === "FAILED" ? paidAt : null,
        cancelledAt: payment.status === "CANCELLED" ? paidAt : null,
        refundedAt: ["REFUNDED", "PARTIALLY_REFUNDED"].includes(payment.status) ? new Date(paidAt.getTime() + 2 * 24 * 60 * 60 * 1000) : null,
      },
    });
  }

  if (order.warehouseInventory) {
    await prisma.warehouseInventory.update({
      where: { id: order.warehouseInventory.id },
      data: {
        createdAt: warehouseAt,
        updatedAt: warehouseAt,
        preparedAt: new Date(warehouseAt.getTime() + 10 * 60 * 60 * 1000),
        receivedAt: warehouseAt,
        pickedUpAt: ["PICKED_UP", "RETURNED"].includes(order.warehouseInventory.status) ? new Date(warehouseAt.getTime() + 36 * 60 * 60 * 1000) : order.warehouseInventory.pickedUpAt,
      },
    });
  }

  for (const assignment of order.dispatchAssignments) {
    await prisma.dispatchAssignment.update({
      where: { id: assignment.id },
      data: {
        assignedAt: dispatchAt,
        acceptedAt: assignment.status === "ACCEPTED" ? new Date(dispatchAt.getTime() + (2 + (index % 6)) * 60 * 60 * 1000) : assignment.acceptedAt,
        rejectedAt: assignment.status === "REJECTED" ? new Date(dispatchAt.getTime() + (1 + (index % 4)) * 60 * 60 * 1000) : assignment.rejectedAt,
        updatedAt: dispatchAt,
        distanceMeters: assignment.distanceMeters ?? 1500 + index * 430,
      },
    });
  }

  for (const tour of order.tours) {
    const durationSeconds = Math.round((tourEnd.getTime() - tourStart.getTime()) / 1000);
    await prisma.distributionTour.update({
      where: { id: tour.id },
      data: {
        createdAt: tourStart,
        updatedAt: reportAt,
        pickupTime: new Date(tourStart.getTime() - 2 * 60 * 60 * 1000),
        startTime: tourStart,
        endTime: tourEnd,
        startedAt: tourStart,
        completedAt: ["COMPLETED", "UNDER_REVIEW", "APPROVED"].includes(tour.status) ? tourEnd : tour.completedAt,
        reviewedAt: tour.status === "APPROVED" ? new Date(tourEnd.getTime() + 4 * 60 * 60 * 1000) : tour.reviewedAt,
        durationSeconds,
        totalDurationSeconds: durationSeconds,
        distanceMeters: 2400 + index * 520,
        totalDistanceMeters: 2400 + index * 520,
      },
    });
  }

  for (const report of order.reports) {
    await prisma.report.update({
      where: { id: report.id },
      data: {
        createdAt: reportAt,
        updatedAt: reportAt,
        generatedAt: reportAt,
        approvedAt: ["APPROVED", "PUBLISHED", "RELEASED_TO_CUSTOMER"].includes(report.status) ? new Date(reportAt.getTime() + 2 * 60 * 60 * 1000) : report.approvedAt,
      },
    });
  }
}

const module19RefundPayments = await prisma.payment.findMany({
  where: { status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] } },
  take: 3,
  orderBy: { createdAt: "asc" },
});

for (let index = 0; index < module19RefundPayments.length; index += 1) {
  const payment = module19RefundPayments[index];
  const createdAt = monthAgo(index + 1, 22);
  await prisma.refund.create({
    data: {
      paymentId: payment.id,
      orderId: payment.orderId,
      customerId: payment.customerId,
      type: index === 0 ? "FULL" : "PARTIAL",
      status: "SUCCEEDED",
      amount: index === 0 ? payment.amount : Number(payment.amount) / 2,
      currency: payment.currency,
      reason: `Seed Modul 19 Refund ${index + 1}`,
      requestedById: admin.id,
      processedAt: new Date(createdAt.getTime() + 2 * 60 * 60 * 1000),
      createdAt,
      updatedAt: createdAt,
    },
  });
}

await prisma.notification.deleteMany({ where: { type: { in: ["LEAD_CREATED", "LEAD_FOLLOWUP_DUE", "LEAD_WON", "LEAD_LOST"] } } });
await prisma.notificationMessage.deleteMany({ where: { data: { path: ["source"], equals: "seed.module20" } } });
await prisma.lead.deleteMany({ where: { source: "seed.module20" } });

const module20Statuses = ["NEW", "CONTACTED", "QUALIFIED", "OFFER_SENT", "TEST_ORDER_PLANNED", "WON", "LOST", "ARCHIVED"];
const module20Priorities = ["LOW", "NORMAL", "HIGH", "URGENT"];
const module20Types = ["CUSTOMER", "CUSTOMER", "CUSTOMER", "PARTNER", "DISTRIBUTOR"];
const module20Cities = ["Koblenz", "Neuwied", "Bendorf", "Lahnstein", "Vallendar", "Andernach", "Mülheim-Kärlich"];
const module20Industries = ["Immobilien", "Restaurant", "Fitness", "Handwerk", "Einzelhandel", "Event", "Verein", "Solar"];
const assignees = [admin, support].filter(Boolean);

for (let index = 0; index < 50; index += 1) {
  const status = module20Statuses[index % module20Statuses.length];
  const priority = module20Priorities[index % module20Priorities.length];
  const city = module20Cities[index % module20Cities.length];
  const createdAt = new Date(Date.now() - (index % 30) * 24 * 60 * 60 * 1000);
  const followupOffset = (index % 9) - 3;
  const nextFollowUpAt = status === "WON" || status === "LOST" || status === "ARCHIVED" || index % 6 === 0
    ? null
    : new Date(Date.now() + followupOffset * 24 * 60 * 60 * 1000);
  const wonCustomer = status === "WON" ? customers[index % customers.length] : null;
  const lead = await prisma.lead.create({
    data: {
      type: module20Types[index % module20Types.length],
      name: `CRM Lead ${index + 1}`,
      companyName: `${module20Industries[index % module20Industries.length]} Betrieb ${index + 1}`,
      email: wonCustomer ? `crm-won-${index + 1}@example.com` : `crm-lead-${index + 1}@example.com`,
      phone: `0261${String(700000 + index).padStart(6, "0")}`,
      city,
      message: `Seed Modul 20: Anfrage für eine lokale Flyerverteilung in ${city}.`,
      status,
      priority,
      source: "seed.module20",
      sourceCampaign: index % 2 === 0 ? "beta-vertrieb-koblenz" : "landingpage-organisch",
      assignedToId: assignees[index % assignees.length]?.id,
      nextFollowUpAt,
      lastContactedAt: ["CONTACTED", "QUALIFIED", "OFFER_SENT", "TEST_ORDER_PLANNED", "WON", "LOST"].includes(status)
        ? new Date(createdAt.getTime() + 36 * 60 * 60 * 1000)
        : null,
      estimatedOrderVolume: new Prisma.Decimal(350 + index * 45),
      expectedFlyerQuantity: 1500 + index * 250,
      notes: `Seed Modul 20: Prioritaet ${priority}, Branche ${module20Industries[index % module20Industries.length]}.`,
      lostReason: status === "LOST" ? "Budget aktuell zu niedrig." : null,
      wonCustomerId: wonCustomer?.id ?? null,
      archivedAt: status === "ARCHIVED" ? new Date(createdAt.getTime() + 5 * 24 * 60 * 60 * 1000) : null,
      createdAt,
      updatedAt: createdAt,
    },
  });

  await prisma.leadNote.create({
    data: {
      leadId: lead.id,
      authorId: assignees[index % assignees.length]?.id,
      body: `Erste CRM-Notiz für ${lead.companyName}. Naechster Schritt: ${nextFollowUpAt ? "Follow-up planen" : "Status beobachten"}.`,
      createdAt: new Date(createdAt.getTime() + 2 * 60 * 60 * 1000),
    },
  });
  await prisma.leadActivity.create({
    data: {
      leadId: lead.id,
      actorId: assignees[index % assignees.length]?.id,
      event: "lead.created",
      toStatus: "NEW",
      detail: "Seed Modul 20 Lead erstellt.",
      metadata: { source: "seed.module20", index },
      createdAt,
    },
  });
  if (status !== "NEW") {
    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        actorId: assignees[index % assignees.length]?.id,
        event: status === "WON" ? "lead.won" : status === "LOST" ? "lead.lost" : "lead.status_changed",
        fromStatus: "NEW",
        toStatus: status,
        detail: `Seed Modul 20 Status ${status}.`,
        metadata: { source: "seed.module20", index },
        createdAt: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000),
      },
    });
  }
  if (nextFollowUpAt) {
    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        actorId: assignees[index % assignees.length]?.id,
        event: "lead.followup_set",
        detail: "Follow-up für CRM Seed gesetzt.",
        metadata: { source: "seed.module20", due: nextFollowUpAt.toISOString() },
        createdAt: new Date(createdAt.getTime() + 3 * 60 * 60 * 1000),
      },
    });
  }
}

for (const user of assignees) {
  for (const [type, title, message] of [
    ["LEAD_CREATED", "Neuer Lead", "Seed Modul 20: Neuer Lead für CRM-Demo."],
    ["LEAD_FOLLOWUP_DUE", "Follow-up faellig", "Seed Modul 20: Ein Lead muss nachgefasst werden."],
    ["LEAD_WON", "Lead gewonnen", "Seed Modul 20: Ein Lead wurde gewonnen."],
    ["LEAD_LOST", "Lead verloren", "Seed Modul 20: Ein Lead wurde verloren."],
  ]) {
    await prisma.notification.create({
      data: { userId: user.id, type, title, message },
    });
    await prisma.notificationMessage.create({
      data: {
        userId: user.id,
        type,
        audience: user.role === "ADMIN" ? "ADMIN" : "INTERNAL",
        channel: "IN_APP",
        subject: title,
        body: message,
        data: { source: "seed.module20", type },
      },
    });
  }
}

await prisma.ticketAttachment.deleteMany({ where: { fileName: { startsWith: "seed-module21" } } });
await prisma.ticketMessage.deleteMany({ where: { ticket: { subject: { startsWith: "Seed Modul 21" } } } });
await prisma.supportTicket.deleteMany({ where: { subject: { startsWith: "Seed Modul 21" } } });

const module21Customers = await prisma.customerProfile.findMany({
  include: { user: true, orders: { include: { reports: true, tours: true, warehouseInventory: true }, orderBy: { createdAt: "desc" } } },
  take: 10,
});
const module21Distributors = await prisma.distributorProfile.findMany({
  where: { reviewStatus: "APPROVED" },
  include: { user: true, tours: { include: { order: true, reports: true, inventory: true }, orderBy: { updatedAt: "desc" } } },
  take: 10,
});
const module21Types = ["CUSTOMER_SUPPORT", "COMPLAINT", "TOUR_ISSUE", "WAREHOUSE_ISSUE", "BILLING_ISSUE", "TECHNICAL_ISSUE", "OTHER"];
const module21Statuses = ["OPEN", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "WAITING_INTERNAL", "RESOLVED", "REJECTED", "CLOSED"];
const module21Priorities = ["LOW", "NORMAL", "HIGH", "URGENT"];

for (let index = 0; index < 30; index += 1) {
  const customer = module21Customers[index % Math.max(module21Customers.length, 1)];
  const order = customer?.orders[index % Math.max(customer.orders.length, 1)];
  const distributor = module21Distributors[index % Math.max(module21Distributors.length, 1)];
  const tour = index % 3 === 0 ? distributor?.tours[index % Math.max(distributor.tours.length, 1)] : order?.tours?.[0];
  const report = index % 2 === 0 ? (order?.reports?.[0] ?? tour?.reports?.[0]) : null;
  const inventory = order?.warehouseInventory ?? tour?.inventory ?? null;
  const status = module21Statuses[index % module21Statuses.length];
  const priority = module21Priorities[index % module21Priorities.length];
  const type = module21Types[index % module21Types.length];
  const createdAt = new Date(Date.now() - (index + 2) * 12 * 60 * 60 * 1000);
  const closedAt = ["RESOLVED", "REJECTED", "CLOSED"].includes(status)
    ? new Date(createdAt.getTime() + (8 + index) * 60 * 60 * 1000)
    : null;
  const ticket = await prisma.supportTicket.create({
    data: {
      ticketNumber: `FLY-TK-2026-${String(index + 1).padStart(6, "0")}`,
      type,
      status,
      priority,
      customerId: customer?.id ?? null,
      distributorId: type === "TOUR_ISSUE" ? distributor?.id ?? null : null,
      orderId: order?.id ?? tour?.orderId ?? null,
      tourId: tour?.id ?? null,
      reportId: report?.id ?? null,
      warehouseInventoryId: type === "WAREHOUSE_ISSUE" ? inventory?.id ?? null : null,
      assignedToId: assignees[index % assignees.length]?.id ?? null,
      createdById: index % 4 === 0 ? distributor?.userId ?? support.id : customer?.userId ?? support.id,
      subject: `Seed Modul 21 Ticket ${index + 1}`,
      description: `Seed Modul 21: Prüffall ${index + 1} für ${type}.`,
      message: `Seed Modul 21: Prüffall ${index + 1} für ${type}.`,
      resolution: closedAt ? "Seed-Abschluss: Fall wurde für die Demo dokumentiert." : null,
      createdAt,
      updatedAt: closedAt ?? createdAt,
      closedAt,
    },
  });

  await prisma.ticketMessage.createMany({
    data: [
      {
        ticketId: ticket.id,
        senderId: ticket.createdById,
        senderRole: index % 4 === 0 ? "DISTRIBUTOR" : "CUSTOMER",
        visibility: "PUBLIC",
        message: `Seed Modul 21: Öffentliche Eingangsnachricht für Ticket ${index + 1}.`,
        createdAt,
      },
      {
        ticketId: ticket.id,
        senderId: support.id,
        senderRole: "SUPPORT_DISPATCHER",
        visibility: "INTERNAL",
        message: `Seed Modul 21: Interne Notiz mit Prüfhinweis für Ticket ${index + 1}.`,
        createdAt: new Date(createdAt.getTime() + 60 * 60 * 1000),
      },
      {
        ticketId: ticket.id,
        senderId: support.id,
        senderRole: "SUPPORT_DISPATCHER",
        visibility: "PUBLIC",
        message: `Seed Modul 21: FLYERO Support hat den Fall aufgenommen.`,
        createdAt: new Date(createdAt.getTime() + 2 * 60 * 60 * 1000),
      },
    ],
  });

  if (index < 6) {
    await prisma.ticketAttachment.create({
      data: {
        ticketId: ticket.id,
        fileUrl: `/uploads/support/seed-module21-${index + 1}.txt`,
        fileName: `seed-module21-${index + 1}.txt`,
        fileType: "text/plain",
        uploadedById: ticket.createdById,
        createdAt,
      },
    });
  }
}

await prisma.numberingSettings.updateMany({
  data: {
    ticketPrefix: "FLY-TK",
    ticketYear: 2026,
    ticketNextNumber: 31,
  },
});

for (const user of assignees) {
  await prisma.notification.createMany({
    data: [
      { userId: user.id, type: "SUPPORT_TICKET_CREATED", title: "Neues Support-Ticket", message: "Seed Modul 21: Neues Ticket ist eingegangen." },
      { userId: user.id, type: "URGENT_SUPPORT_TICKET", title: "Dringende Reklamation", message: "Seed Modul 21: Eine dringende Reklamation wartet." },
    ],
  });
}

await prisma.printOrder.deleteMany({ where: { notes: { contains: "seed.module22" } } });
await prisma.printPartner.deleteMany({ where: { email: { contains: "print-seed-" } } });
await prisma.document.deleteMany({ where: { title: { startsWith: "Seed Modul 22" } } });

const module22Orders = await prisma.order.findMany({
  include: { customer: { include: { user: true } } },
  orderBy: { createdAt: "desc" },
  take: 40,
});
const module22Types = ["FLYER_PDF", "PRINT_FILE", "INDESIGN", "ILLUSTRATOR", "LOGO", "IMAGE", "ZIP", "REPORT", "INVOICE", "CONTRACT", "OTHER"];
const module22Statuses = ["UPLOADED", "UNDER_REVIEW", "APPROVED", "REJECTED", "ARCHIVED"];
const module22Partners = [];

for (let index = 0; index < 5; index += 1) {
  module22Partners.push(await prisma.printPartner.create({
    data: {
      companyName: `Seed Druckpartner ${index + 1}`,
      contactName: `Print Kontakt ${index + 1}`,
      email: `print-seed-${index + 1}@example.com`,
      phone: `+49 261 9300${index}`,
      address: { street: "Druckallee", houseNumber: String(index + 1), postalCode: "56068", city: ["Koblenz", "Köln", "Frankfurt", "Berlin", "Mainz"][index], country: "DE" },
      isActive: index !== 4,
    },
  }));
}

for (let index = 0; index < 80; index += 1) {
  const order = module22Orders[index % module22Orders.length];
  const documentType = module22Types[index % module22Types.length];
  const status = module22Statuses[index % module22Statuses.length];
  const versionCount = index < 40 ? 2 : 1;
  const uploadedAt = new Date(Date.now() - (index + 1) * 6 * 60 * 60 * 1000);
  const document = await prisma.document.create({
    data: {
      orderId: order.id,
      customerId: order.customerId,
      documentType,
      title: `Seed Modul 22 Dokument ${index + 1}`,
      originalFilename: `seed-module22-${index + 1}.${documentType === "ZIP" ? "zip" : documentType === "IMAGE" ? "png" : "pdf"}`,
      storedFilename: `seed/module22/document-${index + 1}.dat`,
      mimeType: documentType === "ZIP" ? "application/zip" : documentType === "IMAGE" ? "image/png" : "application/pdf",
      extension: documentType === "ZIP" ? "zip" : documentType === "IMAGE" ? "png" : "pdf",
      fileSize: 120000 + index * 1000,
      checksum: createHash("sha256").update(`seed-module22-${index}`).digest("hex"),
      version: versionCount,
      status,
      uploadedById: order.customer.userId,
      uploadedAt,
      approvedById: status === "APPROVED" ? admin.id : null,
      approvedAt: status === "APPROVED" ? new Date(uploadedAt.getTime() + 4 * 60 * 60 * 1000) : null,
      rejectedReason: status === "REJECTED" ? "Seed Modul 22: Beschnitt oder Auflösung prüfen." : null,
      createdAt: uploadedAt,
      updatedAt: uploadedAt,
    },
  });
  for (let version = 1; version <= versionCount; version += 1) {
    await prisma.documentVersion.create({
      data: {
        documentId: document.id,
        version,
        fileUrl: `/api/customer/documents/${document.id}/download?version=${version}`,
        checksum: createHash("sha256").update(`seed-module22-${index}-v${version}`).digest("hex"),
        uploadedById: order.customer.userId,
        createdAt: new Date(uploadedAt.getTime() + version * 60 * 60 * 1000),
      },
    });
  }
  await prisma.documentComment.create({
    data: {
      documentId: document.id,
      userId: status === "UNDER_REVIEW" ? support.id : order.customer.userId,
      visibility: index % 3 === 0 ? "INTERNAL" : "PUBLIC",
      message: `Seed Modul 22 Kommentar für Dokument ${index + 1}.`,
      createdAt: new Date(uploadedAt.getTime() + 2 * 60 * 60 * 1000),
    },
  });
}

const module22PrintStatuses = ["REQUESTED", "APPROVED", "IN_PRODUCTION", "SHIPPED", "DELIVERED", "RECEIVED_IN_WAREHOUSE", "READY_FOR_DISTRIBUTION", "CANCELLED"];
for (let index = 0; index < 25; index += 1) {
  const order = module22Orders[index % module22Orders.length];
  await prisma.printOrder.create({
    data: {
      orderId: order.id,
      customerId: order.customerId,
      printerId: module22Partners[index % module22Partners.length].id,
      status: module22PrintStatuses[index % module22PrintStatuses.length],
      printFormat: ["DIN_A4", "DIN_A5", "DIN_LANG", "SQUARE", "CUSTOM"][index % 5],
      paperType: "Bilderdruck",
      paperWeight: [90, 115, 135, 170, 250, 300][index % 6],
      colorMode: ["4/4", "4/0", "1/1"][index % 3],
      doubleSided: index % 2 === 0,
      folded: ["NONE", "HALF_FOLD", "ROLL_FOLD", "Z_FOLD"][index % 4],
      finishing: ["NONE", "VARNISH", "MATTE", "GLOSS"][index % 4],
      quantity: 1000 + index * 500,
      notes: `seed.module22 Druckauftrag ${index + 1}`,
      trackingNumber: index % 3 === 0 ? `TRK-M22-${index + 1}` : null,
      estimatedDelivery: new Date(Date.now() + (index + 2) * 24 * 60 * 60 * 1000),
      estimatedNetPrice: null,
      estimatedGrossPrice: null,
      priceSnapshot: { mode: "manual_later", note: "Seed: echte Druckpreise werden spaeter mit FLYERO-Konditionen gepflegt." },
    },
  });
}

await prisma.auditLog.createMany({
  data: [
    { userId: admin.id, action: "document.uploaded", entityType: "Document", entityId: "seed-module22-document" },
    { userId: admin.id, action: "document.approved", entityType: "Document", entityId: "seed-module22-document" },
    { userId: admin.id, action: "document.version_uploaded", entityType: "Document", entityId: "seed-module22-document" },
    { userId: admin.id, action: "print.requested", entityType: "PrintOrder", entityId: "seed-module22-print" },
    { userId: admin.id, action: "print.shipped", entityType: "PrintOrder", entityId: "seed-module22-print" },
  ],
});

await prisma.warehouseStockCount.deleteMany({ where: { notes: { contains: "seed.module23" } } });
await prisma.warehouseTransfer.deleteMany({ where: { notes: { contains: "seed.module23" } } });
await prisma.logisticsShipment.deleteMany({ where: { notes: { contains: "seed.module23" } } });

const module23Warehouses = await prisma.warehouse.findMany({
  where: { id: { in: module23WarehouseSeed.map((item) => item.id) } },
  orderBy: { code: "asc" },
});
const activeModule23Warehouses = module23Warehouses.filter((item) => item.isActive);
const module23Orders = await prisma.order.findMany({
  include: { customer: { include: { user: true } }, warehouseInventory: true, printOrders: true },
  orderBy: { createdAt: "desc" },
  take: 25,
});
const module23Inventories = await prisma.warehouseInventory.findMany({
  include: { order: true },
  orderBy: { updatedAt: "desc" },
  take: 20,
});

if (module23Inventories[0]) {
  await prisma.warehouseInventory.update({
    where: { id: module23Inventories[0].id },
    data: { warehouseId: warehouse.id },
  });
}

for (let index = 0; index < Math.min(15, module23Orders.length); index += 1) {
  const order = module23Orders[index];
  const targetWarehouse = activeModule23Warehouses[index % activeModule23Warehouses.length] ?? warehouse;
  await prisma.order.update({
    where: { id: order.id },
    data: {
      assignedWarehouseId: targetWarehouse.id,
      warehouseAssignedAt: new Date(Date.now() - (index + 1) * 60 * 60 * 1000),
      warehouseAssignmentReason: `seed.module23 Region/Fallback für ${order.postalCode}`,
    },
  });
  const shipmentStatus = ["CREATED", "IN_TRANSIT", "DELIVERED", "RECEIVED", "DAMAGED"][index % 5];
  const shipment = await prisma.logisticsShipment.create({
    data: {
      orderId: order.id,
      printOrderId: order.printOrders[0]?.id ?? null,
      warehouseId: targetWarehouse.id,
      shipmentType: order.printOrders[0] ? "PRINTER_TO_WAREHOUSE" : "CUSTOMER_TO_WAREHOUSE",
      status: shipmentStatus,
      carrier: ["DHL", "DPD", "GLS", "Eigenanlieferung"][index % 4],
      trackingNumber: `M23-TRK-${String(index + 1).padStart(3, "0")}`,
      senderName: order.printOrders[0] ? "Seed Druckpartner" : order.customer.companyName,
      senderAddress: { city: order.city, postalCode: order.postalCode, country: "DE" },
      recipientName: targetWarehouse.name,
      recipientAddress: targetWarehouse.address,
      expectedDeliveryDate: new Date(Date.now() + (index - 3) * 24 * 60 * 60 * 1000),
      deliveredAt: ["DELIVERED", "RECEIVED", "DAMAGED"].includes(shipmentStatus) ? new Date(Date.now() - index * 60 * 60 * 1000) : null,
      receivedById: shipmentStatus === "RECEIVED" ? warehouseStaff.id : null,
      notes: `seed.module23 Sendung ${index + 1}`,
    },
  });
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: index === 0 ? "logistics.warehouse_assigned" : "logistics.shipment_created",
      entityType: index === 0 ? "Order" : "LogisticsShipment",
      entityId: index === 0 ? order.id : shipment.id,
      newValues: { warehouseId: targetWarehouse.id, shipmentStatus },
    },
  });
}

for (let index = 0; index < Math.min(8, module23Inventories.length); index += 1) {
  const inventory = module23Inventories[index];
  const fromWarehouse = activeModule23Warehouses[index % activeModule23Warehouses.length] ?? warehouse;
  const toWarehouse = activeModule23Warehouses[(index + 1) % activeModule23Warehouses.length] ?? warehouse;
  await prisma.warehouseInventory.update({
    where: { id: inventory.id },
    data: { warehouseId: fromWarehouse.id },
  });
  const transferStatus = ["REQUESTED", "APPROVED", "IN_TRANSIT", "RECEIVED"][index % 4];
  await prisma.warehouseTransfer.create({
    data: {
      fromWarehouseId: fromWarehouse.id,
      toWarehouseId: toWarehouse.id,
      inventoryId: inventory.id,
      status: transferStatus,
      quantity: Math.max(100, inventory.remainingFlyers ?? inventory.expectedFlyers ?? 1000),
      requestedById: admin.id,
      approvedById: ["APPROVED", "IN_TRANSIT", "RECEIVED"].includes(transferStatus) ? admin.id : null,
      shippedAt: ["IN_TRANSIT", "RECEIVED"].includes(transferStatus) ? new Date(Date.now() - 12 * 60 * 60 * 1000) : null,
      receivedAt: transferStatus === "RECEIVED" ? new Date() : null,
      notes: `seed.module23 Umlagerung ${index + 1}`,
    },
  });
  await prisma.warehouseStockCount.create({
    data: {
      warehouseId: transferStatus === "RECEIVED" ? toWarehouse.id : fromWarehouse.id,
      inventoryId: inventory.id,
      expectedQuantity: inventory.remainingFlyers ?? inventory.expectedFlyers,
      countedQuantity: Math.max(0, (inventory.remainingFlyers ?? inventory.expectedFlyers) - (index % 3 === 0 ? 25 : 0)),
      difference: index % 3 === 0 ? -25 : 0,
      countedById: warehouseStaff.id,
      notes: `seed.module23 Inventur ${index + 1}`,
    },
  });
}

if (module23Inventories[0]) {
  await prisma.warehouseInventory.update({
    where: { id: module23Inventories[0].id },
    data: { warehouseId: warehouse.id },
  });
}

await prisma.auditLog.createMany({
  data: [
    { userId: admin.id, action: "logistics.shipment_status_changed", entityType: "LogisticsShipment", entityId: "seed-module23-shipment" },
    { userId: warehouseStaff.id, action: "logistics.shipment_received", entityType: "LogisticsShipment", entityId: "seed-module23-shipment" },
    { userId: warehouseStaff.id, action: "logistics.shipment_damaged", entityType: "LogisticsShipment", entityId: "seed-module23-shipment" },
    { userId: admin.id, action: "logistics.transfer_requested", entityType: "WarehouseTransfer", entityId: "seed-module23-transfer" },
    { userId: admin.id, action: "logistics.transfer_approved", entityType: "WarehouseTransfer", entityId: "seed-module23-transfer" },
    { userId: warehouseStaff.id, action: "logistics.transfer_received", entityType: "WarehouseTransfer", entityId: "seed-module23-transfer" },
    { userId: warehouseStaff.id, action: "logistics.stock_count_created", entityType: "WarehouseStockCount", entityId: "seed-module23-stock-count" },
    { userId: admin.id, action: "logistics.capacity_warning", entityType: "Warehouse", entityId: "seed-module23-warehouse" },
  ],
});

await prisma.notification.createMany({
  data: [
    { userId: admin.id, type: "LOGISTICS_SHIPMENT_CREATED", title: "Neue Lieferung erwartet", message: "Seed Modul 23: Eine neue Lieferung wird erwartet." },
    { userId: admin.id, type: "LOGISTICS_CAPACITY_WARNING", title: "Kapazitätswarnung", message: "Seed Modul 23: Lager Koeln erreicht hohe Auslastung." },
    { userId: warehouseStaff.id, type: "LOGISTICS_TRANSFER_INBOUND", title: "Umlagerung eingetroffen", message: "Seed Modul 23: Eine Umlagerung ist für dein Lager vorgesehen." },
    { userId: warehouseStaff.id, type: "LOGISTICS_STOCK_COUNT_REQUIRED", title: "Inventur erforderlich", message: "Seed Modul 23: Bitte Bestand prüfen." },
  ],
});

await prisma.orderExperienceEvent.deleteMany({ where: { source: "seed.module24" } });
const module24Orders = await prisma.order.findMany({
  include: { customer: true, distributionArea: true, assignedWarehouse: true },
  orderBy: { createdAt: "desc" },
  take: 18,
});
for (let index = 0; index < module24Orders.length; index += 1) {
  const order = module24Orders[index];
  await prisma.orderExperienceEvent.create({
    data: {
      orderId: order.id,
      customerId: order.customerId,
      userId: order.customer.userId,
      eventType: index % 5 === 0 ? "WIZARD_STARTED" : "ORDER_CREATED",
      source: "seed.module24",
      city: order.city,
      postalCode: order.postalCode,
      areaName: order.targetAreaName,
      areaType: order.distributionArea?.type ?? "POLYGON",
      durationMs: 75_000 + index * 9_000,
      clickCount: 7 + (index % 6),
      fieldCount: 9,
      usedAutocomplete: index % 2 === 0,
      usedSavedArea: Boolean(order.distributionAreaId),
      polygonPoints: 4 + (index % 3),
      households: order.estimatedHouseholds,
      flyerQuantity: order.flyerQuantity,
      coverageAreaSqm: order.coverageAreaSqm,
      routeDistanceMeters: order.estimatedDistanceMeters,
      routeDurationMinutes: order.estimatedDistanceMeters ? Math.max(20, Math.round(order.estimatedDistanceMeters / 68 + (order.estimatedHouseholds ?? 0) * 0.38)) : null,
      metadata: {
        module: 24,
        assignedWarehouseId: order.assignedWarehouseId,
        ux: "smart-order-wizard",
      },
    },
  });
}
await prisma.auditLog.create({
  data: {
    userId: admin.id,
    action: "module24.seeded",
    entityType: "OrderExperienceEvent",
    entityId: "seed.module24",
    newValues: { events: module24Orders.length, autocomplete: true, heatmap: true, routing: true },
  },
});

await prisma.$disconnect();
