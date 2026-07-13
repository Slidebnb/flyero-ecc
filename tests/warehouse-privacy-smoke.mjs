import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = [
  "src/app/warehouse/dashboard/page.tsx",
  "src/app/warehouse/checkin/page.tsx",
  "src/app/warehouse/shipments/page.tsx",
  "src/app/warehouse/transfers/page.tsx",
  "src/app/warehouse/stock-counts/page.tsx",
  "src/app/warehouse/inventory/page.tsx",
  "src/app/warehouse/inventory/[id]/page.tsx",
  "src/app/api/warehouse/inventory/route.ts",
  "src/app/api/warehouse/inventory/[id]/route.ts",
  "src/app/api/warehouse/shipments/route.ts",
  "src/app/api/warehouse/transfers/route.ts",
  "src/app/api/warehouse/stock-counts/route.ts",
  "src/app/api/warehouse/checkin/route.ts",
  "src/app/api/warehouse/status/route.ts",
];

const sources = await Promise.all(files.map(async (file) => [file, await readFile(file, "utf8")]));

for (const [file, source] of sources) {
  assert(!source.includes("customer: true"), `${file} lädt weiterhin ein vollständiges Kundenobjekt.`);
  assert(!source.includes("customer.companyName"), `${file} zeigt weiterhin den Firmennamen eines Kunden.`);
}

const transfers = sources.find(([file]) => file === "src/app/api/warehouse/transfers/route.ts")[1];
assert(!transfers.includes("requestedBy: true"), "Umlagerungen geben interne Antragstellerobjekte aus.");
assert(!transfers.includes("approvedBy: true"), "Umlagerungen geben interne Freigabeobjekte aus.");
assert(transfers.includes("select:"), "Umlagerungen verwenden keine explizite Antwort-Whitelist.");

const checkinPage = sources.find(([file]) => file === "src/app/warehouse/checkin/page.tsx")[1];
assert(checkinPage.includes("assignedWarehouseId"), "Wareneingang filtert Aufträge nicht nach dem zugewiesenen Lager.");

console.log("Warehouse privacy smoke checks passed.");
