import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  fetchMeineHeimatExport,
  meineHeimatStatisticsSource,
  parseMeineHeimatCsv,
  readMeineHeimatConfig,
} from "../src/lib/meineHeimatStatistics.ts";

const apply = process.argv.includes("--apply");
const yearArgument = process.argv.find((value) => value.startsWith("--year="));
const year = yearArgument ? Number(yearArgument.slice("--year=".length)) : Number(process.env.MEINE_HEIMAT_STATISTICS_YEAR || 2026);

if (!Number.isInteger(year) || year < 1900 || year > 2200) {
  throw new Error("MEINE_HEIMAT_STATISTICS_YEAR muss ein gueltiges Jahr sein.");
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL fehlt.");

const config = readMeineHeimatConfig();
if (!config.householdMetricId) {
  throw new Error("MEINE_HEIMAT_HOUSEHOLD_LFDNR fehlt. Ohne bestaetigten Statistik-Merkmalschluessel wird nichts synchronisiert.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

function chunks(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

try {
  const areas = await prisma.distributionArea.findMany({
    where: {
      officialRegionCode: { not: null },
      status: "ACTIVE",
      reusable: true,
      dataSourceType: { in: ["OFFICIAL", "LICENSED", "IMPORTED"] },
    },
    select: { id: true, name: true, officialRegionCode: true },
    orderBy: { name: "asc" },
  });

  const eligibleAreas = areas.filter((area) => /^\d{12}$/.test(area.officialRegionCode ?? ""));
  if (!eligibleAreas.length) {
    console.log("Meine-Heimat-Synchronisation: Keine aktiven amtlichen Gebiete mit 12-stelligem ARS gefunden. Keine Daten geaendert.");
    process.exit(0);
  }

  const values = [];
  for (const regionChunk of chunks(eligibleAreas, 50)) {
    const exportResult = await fetchMeineHeimatExport({
      config,
      regions: regionChunk.map((area) => area.officialRegionCode),
      metricIds: [config.householdMetricId],
      years: [year],
    });
    const records = parseMeineHeimatCsv(exportResult.text, {
      regions: regionChunk.map((area) => area.officialRegionCode),
      metricId: config.householdMetricId,
      year,
      valueColumn: config.valueColumn,
    });
    const recordByRegion = new Map(records.map((record) => [record.regionArs, record]));
    for (const area of regionChunk) {
      const record = recordByRegion.get(area.officialRegionCode);
      if (!record || !Number.isInteger(record.value) || record.value < 0) {
        throw new Error(`Meine-Heimat-Synchronisation: Kein eindeutiger Haushaltswert fuer ${area.name} (${area.officialRegionCode}) im Jahr ${year}.`);
      }
      values.push({ area, record });
    }
  }

  if (!apply) {
    console.log(`Meine-Heimat-Synchronisation geprueft: ${values.length} Gebiete, Jahr ${year}. Keine DB-Schreiboperation ohne --apply.`);
    for (const item of values.slice(0, 10)) console.log(`${item.area.name}: ${item.record.value} Haushalte`);
    process.exit(0);
  }

  await prisma.$transaction(async (tx) => {
    for (const item of values) {
      const households = item.record.value;
      await tx.distributionArea.update({
        where: { id: item.area.id },
        data: {
          estimatedHouseholds: households,
          estimatedFlyers: null,
          dataSourceName: "Meine Heimat Statistik API",
          dataSourceType: "OFFICIAL",
          dataSourceUrl: meineHeimatStatisticsSource,
          dataUpdatedAt: new Date(`${year}-12-31T23:59:59.000Z`),
          confidence: new Prisma.Decimal("1.000"),
        },
      });
      await tx.areaHouseholdEstimate.create({
        data: {
          areaId: item.area.id,
          households,
          estimatedHouseholds: households,
          estimatedFlyers: null,
          method: "OFFICIAL_IMPORT",
          source: "Meine Heimat Statistik API",
          sourceUrl: meineHeimatStatisticsSource,
          sourceYear: year,
          confidence: new Prisma.Decimal("1.000"),
          notes: `Amtlicher Statistikexport fuer ARS ${item.area.officialRegionCode}; Merkmal ${config.householdMetricId}.`,
          validFrom: new Date(`${year}-01-01T00:00:00.000Z`),
          validTo: new Date(`${year}-12-31T23:59:59.000Z`),
        },
      });
    }
  });
  console.log(`Meine-Heimat-Synchronisation angewendet: ${values.length} Gebiete, Jahr ${year}.`);
} finally {
  await prisma.$disconnect();
}
