import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const smartMaps = readFileSync("src/lib/smartMaps.ts", "utf8");
const orderRoute = readFileSync("src/app/api/customer/orders/route.ts", "utf8");

const areaQueryStart = smartMaps.indexOf("prisma.distributionArea.findMany({");
const areaQueryEnd = smartMaps.indexOf("    }),", areaQueryStart);
assert.ok(areaQueryStart >= 0 && areaQueryEnd > areaQueryStart, "Gebietsabfrage in smartMaps.ts fehlt.");
const areaQuery = smartMaps.slice(areaQueryStart, areaQueryEnd);

assert.match(areaQuery, /\.\.\.productionAreaWhere\(\)/, "Produktions-Gebietsabfrage blendet Seed-Gebiete nicht aus.");
assert.match(smartMaps, /const singleAreaNeedsManualReview = Boolean\(!areaSelection && !warehouseMatch\?\.matchedRegion\)/, "Einzelgebiete ohne aktive Region erzwingen keine manuelle Prüfung.");
assert.match(smartMaps, /const needsManualReview = Boolean\(includeOperationalData && \(areaNeedsManualReview \|\| segmentNeedsManualReview \|\| singleAreaNeedsManualReview\)\)/, "Manuelle Logistikprüfung wird nicht an die zentrale operative Gebietsprüfung gekoppelt.");
assert.match(orderRoute, /const status: OrderStatus = data\.completionPath === "direct_payment"\s*\? requiresManualReview \? "UNDER_REVIEW" : "PAYMENT_PENDING"/, "Direktbuchungen umgehen bei manueller Gebietsprüfung den Prüfstatus.");
assert.match(orderRoute, /if \(!requiresManualReview\) \{[\s\S]*?await assignWarehouseForOrder/, "Aufträge ohne bestätigte Logistik dürfen kein Lager automatisch reservieren.");

console.log("Single-area logistics gate smoke checks passed.");
