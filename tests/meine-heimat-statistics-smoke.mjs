import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const {
  buildMeineHeimatExportRequest,
  fetchMeineHeimatExport,
  parseMeineHeimatCsv,
} = await import("../src/lib/meineHeimatStatistics.ts");

const request = buildMeineHeimatExportRequest({
  regions: ["071110000000"],
  metricIds: ["1.2.3.4"],
  years: [2026],
});

assert.deepEqual(request, {
  outputFormat: "CSV",
  regions: ["071110000000"],
  lfdnrs: ["1.2.3.4"],
  years: [2026],
});
assert.throws(
  () => buildMeineHeimatExportRequest({ regions: ["Koblenz"], metricIds: ["1.2.3.4"], years: [2026] }),
  /ARS|Region/,
  "Freie Ortsnamen duerfen nicht als Statistikregion gesendet werden.",
);
assert.throws(
  () => buildMeineHeimatExportRequest({ regions: ["071110000000"], metricIds: [], years: [2026] }),
  /Merkmal|Lfdnr/,
  "Ohne explizite Statistikmerkmale darf kein Export erfolgen.",
);

const calls = [];
const response = await fetchMeineHeimatExport({
  config: {
    baseUrl: "https://meine-heimat-statistik.de/api",
    username: "api-user",
    password: "api-password",
    timeoutMs: 1000,
  },
  regions: ["071110000000"],
  metricIds: ["1.2.3.4"],
  years: [2026],
  fetchImpl: async (url, init) => {
    calls.push({ url, init });
    return new Response("ARS;Jahr;Lfdnr;Wert\n071110000000;2026;1.2.3.4;1234\n", {
      status: 200,
      headers: { "content-type": "text/csv; charset=utf-8" },
    });
  },
});

assert.equal(calls.length, 1);
assert.equal(calls[0].url, "https://meine-heimat-statistik.de/api/v1/export");
assert.equal(calls[0].init.method, "POST");
assert.match(calls[0].init.headers.authorization, /^Basic /);
assert.equal(JSON.parse(calls[0].init.body).outputFormat, "CSV");
assert.deepEqual(parseMeineHeimatCsv(response.text, { regions: ["071110000000"], metricId: "1.2.3.4", year: 2026 }), [
  { regionArs: "071110000000", metricId: "1.2.3.4", year: 2026, value: 1234 },
]);

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync("prisma/migrations/20260729100000_add_official_region_code/migration.sql", "utf8");
const syncScript = readFileSync("scripts/sync-meine-heimat-statistics.mjs", "utf8");
assert.match(schema, /officialRegionCode\s+String\?/);
assert.match(migration, /ADD COLUMN "officialRegionCode" TEXT/);
assert.match(syncScript, /Kein Teil der Gruppe|Kein eindeutiger Haushaltswert|Keine Daten geaendert/);
assert.match(syncScript, /OFFICIAL_IMPORT/);

console.log("Meine-Heimat-Statistik-Client-Smoke: OK");
