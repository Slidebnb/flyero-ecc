import { readFileSync } from "node:fs";
function assert(condition, message) { if (!condition) throw new Error(message); }
const source = readFileSync("src/app/api/customer/orders/route.ts", "utf8");
for (const snippet of ["targetAreaGeoJson", "serverCoverageAreaSqm", "serverHouseholds", "serverDistanceMeters", "areaCalculationSnapshot", "quote: intelligence.metrics.quote"]) {
  assert(source.includes(snippet), `Order-Snapshot muss enthalten: ${snippet}`);
}
assert(source.includes("intelligence.metrics.coverageAreaSqm"), "Fläche darf nicht aus Clientwerten übernommen werden.");
assert(source.includes("intelligence.metrics.households"), "Haushalte dürfen nicht aus Clientwerten übernommen werden.");
console.log("Order area snapshot integrity checks passed.");
