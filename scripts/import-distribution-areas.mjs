import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";

const AREA_TYPES = ["POSTAL_CODE", "CITY", "DISTRICT", "POLYGON", "RADIUS", "CUSTOM", "DELIVERY_ZONE"];
const SOURCE_TYPES = ["SEED", "ADMIN", "OFFICIAL", "LICENSED", "IMPORTED", "ESTIMATED"];
const ESTIMATE_METHOD_BY_SOURCE = {
  SEED: "SEED",
  ADMIN: "ADMIN_ENTRY",
  OFFICIAL: "OFFICIAL_IMPORT",
  LICENSED: "LICENSED_IMPORT",
  IMPORTED: "IMPORT",
  ESTIMATED: "AREA_INTERPOLATION",
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }
  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function toNumber(value) {
  if (value == null || String(value).trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function toDate(value) {
  if (!value || String(value).trim() === "") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseGeoJson(value) {
  if (!value || String(value).trim() === "") return undefined;
  return JSON.parse(value);
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "gebiet";
}

function areaSqmFromGeoJson(geoJson) {
  const ring = geoJson?.features?.[0]?.geometry?.coordinates?.[0];
  if (!Array.isArray(ring) || ring.length < 4) return undefined;
  const metersPerDegreeLat = 111_320;
  const avgLat = ring.reduce((sum, point) => sum + Number(point[1]), 0) / ring.length;
  const metersPerDegreeLng = Math.cos((avgLat * Math.PI) / 180) * metersPerDegreeLat;
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [lngA, latA] = ring[index].map(Number);
    const [lngB, latB] = ring[index + 1].map(Number);
    area += lngA * metersPerDegreeLng * (latB * metersPerDegreeLat) - lngB * metersPerDegreeLng * (latA * metersPerDegreeLat);
  }
  return Math.round(Math.abs(area / 2));
}

const importRowSchema = z.object({
  postalCode: z.string().min(3),
  city: z.string().min(2),
  district: z.string().optional(),
  name: z.string().min(2),
  type: z.enum(AREA_TYPES),
  geometryGeoJson: z.string().optional(),
  estimatedHouseholds: z.coerce.number().int().nonnegative(),
  estimatedResidents: z.coerce.number().int().nonnegative().optional(),
  estimatedDwellings: z.coerce.number().int().nonnegative().optional(),
  residentialBuildings: z.coerce.number().int().nonnegative().optional(),
  source: z.string().min(2),
  sourceType: z.enum(SOURCE_TYPES),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  sourceYear: z.coerce.number().int().min(1900).max(2200).optional(),
  confidence: z.coerce.number().min(0).max(1),
  licenseNote: z.string().optional(),
  dataUpdatedAt: z.string().optional(),
});

function loadRows(filePath) {
  const table = parseCsv(readFileSync(filePath, "utf8"));
  const [headers, ...rows] = table;
  if (!headers?.length) throw new Error("CSV enthaelt keine Kopfzeile.");
  return rows.map((row, index) => {
    const raw = Object.fromEntries(headers.map((header, cellIndex) => [header.trim(), row[cellIndex]?.trim() ?? ""]));
    const parsed = importRowSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new Error(`Zeile ${index + 2}: ${issue.path.join(".")} ${issue.message}`);
    }
    const data = parsed.data;
    const geometryGeoJson = parseGeoJson(data.geometryGeoJson);
    const coverageAreaSqm = areaSqmFromGeoJson(geometryGeoJson);
    return {
      ...data,
      geometryGeoJson,
      coverageAreaSqm,
      dataUpdatedAt: toDate(data.dataUpdatedAt),
      estimatedResidents: toNumber(data.estimatedResidents),
      estimatedDwellings: toNumber(data.estimatedDwellings),
      residentialBuildings: toNumber(data.residentialBuildings),
    };
  });
}

async function applyRows(rows) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL fehlt.");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    for (const row of rows) {
      const slug = slugify(`${row.postalCode}-${row.name}`);
      const area = await prisma.distributionArea.upsert({
        where: { slug },
        update: {
          name: row.name,
          type: row.type,
          city: row.city,
          postalCode: row.postalCode,
          district: row.district || null,
          geoJson: row.geometryGeoJson ?? undefined,
          geometryGeoJson: row.geometryGeoJson ?? undefined,
          coverageAreaSqm: row.coverageAreaSqm ?? null,
          areaKm2: row.coverageAreaSqm ? row.coverageAreaSqm / 1_000_000 : null,
          estimatedHouseholds: row.estimatedHouseholds,
          estimatedFlyers: Math.ceil(row.estimatedHouseholds * 1.1),
          dataSourceName: row.source,
          dataSourceType: row.sourceType,
          dataSourceUrl: row.sourceUrl || null,
          licenseNote: row.licenseNote || null,
          dataUpdatedAt: row.dataUpdatedAt ?? null,
          confidence: row.confidence,
        },
        create: {
          slug,
          name: row.name,
          type: row.type,
          city: row.city,
          postalCode: row.postalCode,
          district: row.district || null,
          geoJson: row.geometryGeoJson ?? undefined,
          geometryGeoJson: row.geometryGeoJson ?? undefined,
          coverageAreaSqm: row.coverageAreaSqm ?? null,
          areaKm2: row.coverageAreaSqm ? row.coverageAreaSqm / 1_000_000 : null,
          estimatedHouseholds: row.estimatedHouseholds,
          estimatedFlyers: Math.ceil(row.estimatedHouseholds * 1.1),
          dataSourceName: row.source,
          dataSourceType: row.sourceType,
          dataSourceUrl: row.sourceUrl || null,
          licenseNote: row.licenseNote || null,
          dataUpdatedAt: row.dataUpdatedAt ?? null,
          confidence: row.confidence,
        },
      });
      await prisma.areaHouseholdEstimate.create({
        data: {
          areaId: area.id,
          households: row.estimatedHouseholds,
          estimatedHouseholds: row.estimatedHouseholds,
          estimatedResidents: row.estimatedResidents,
          estimatedDwellings: row.estimatedDwellings,
          residentialBuildings: row.residentialBuildings,
          estimatedFlyers: Math.ceil(row.estimatedHouseholds * 1.1),
          coverageAreaSqm: row.coverageAreaSqm ?? null,
          method: ESTIMATE_METHOD_BY_SOURCE[row.sourceType],
          source: row.source,
          sourceUrl: row.sourceUrl || null,
          sourceYear: row.sourceYear,
          confidence: row.confidence,
          notes: row.licenseNote || null,
          validFrom: row.dataUpdatedAt ?? null,
        },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

const args = process.argv.slice(2);
const filePath = args.find((arg) => !arg.startsWith("--")) ?? "templates/distribution-areas-import-template.csv";
const apply = args.includes("--apply");
const rows = loadRows(filePath);

if (apply) {
  await applyRows(rows);
  console.log(`Import abgeschlossen: ${rows.length} Gebiete verarbeitet.`);
} else {
  console.log(`Import validiert: ${rows.length} Gebiete. Keine DB-Schreiboperation ohne --apply.`);
}
