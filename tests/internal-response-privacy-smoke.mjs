import assert from "node:assert/strict";
import fs from "node:fs";

const sources = [
  "src/app/api/admin/tours/route.ts",
  "src/app/api/admin/tours/[id]/route.ts",
  "src/app/api/admin/orders/[id]/route.ts",
  "src/app/api/admin/reports/[id]/route.ts",
  "src/app/api/admin/logistics/shipments/route.ts",
  "src/lib/logistics.ts",
  "src/app/admin/tours/[id]/page.tsx",
];

for (const file of sources) {
  const source = fs.readFileSync(file, "utf8");
  assert(!source.includes("user: true"), `${file} lädt ein vollständiges User-Objekt.`);
  assert(!source.includes("receivedBy: true"), `${file} lädt ein vollständiges Empfangs-User-Objekt.`);
}

const tourApi = fs.readFileSync("src/app/api/admin/tours/route.ts", "utf8");
const orderApi = fs.readFileSync("src/app/api/admin/orders/[id]/route.ts", "utf8");
const reportApi = fs.readFileSync("src/app/api/admin/reports/[id]/route.ts", "utf8");
const shipmentApi = fs.readFileSync("src/app/api/admin/logistics/shipments/route.ts", "utf8");
assert(tourApi.includes("email: true") && tourApi.includes("status: true"), "Tour-API verwendet keine User-Allowlist.");
assert(orderApi.includes("user: { select:") && orderApi.includes("passwordHash") === false, "Order-API verwendet keine User-Allowlist.");
assert(reportApi.includes("user: { select:") && reportApi.includes("passwordHash") === false, "Report-API verwendet keine User-Allowlist.");
assert(shipmentApi.includes("receivedBy: { select:"), "Shipment-API verwendet keine Empfangs-User-Allowlist.");

console.log("Internal response privacy smoke checks passed.");
