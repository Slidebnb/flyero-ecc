import { readFileSync } from "node:fs";
function assert(condition, message) { if (!condition) throw new Error(message); }
const quote = readFileSync("src/lib/planningQuote.ts", "utf8");
const maps = readFileSync("src/lib/smartMaps.ts", "utf8");
const intelligenceHook = readFileSync("src/app/customer/orders/new/hooks/useOrderIntelligence.ts", "utf8");
assert(quote.includes("coverageAreaSqm") && quote.includes("perimeterMeters"), "Fläche und Umfang fehlen im Quote-Fingerprint.");
assert(maps.includes('route: routeDistanceMeters === null ? "unavailable" : "polygon-estimate"'), "Streckenquelle muss ehrlich benannt werden.");
assert(intelligenceHook.includes("setIntelligence(null)"), "Alte Kennzahlen müssen vor einer neuen Berechnung verschwinden.");
assert(intelligenceHook.includes("AbortController"), "Veraltete Berechnungsrequests müssen abbrechbar sein.");
console.log("Order metrics consistency checks passed.");
