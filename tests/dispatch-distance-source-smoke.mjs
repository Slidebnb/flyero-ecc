import { readFileSync } from "node:fs";
function assert(condition, message) { if (!condition) throw new Error(message); }
const dispatch = readFileSync("src/lib/dispatch.ts", "utf8");
const routing = readFileSync("src/lib/routing.ts", "utf8");
assert(dispatch.includes('distanceSource: "address-geodesic-estimate" | "unavailable"'), "Dispatch muss unbekannte Entfernungen transparent markieren.");
assert(!dispatch.includes("regionGroups"), "Dispatch darf keine festen lokalen Ortsgruppen enthalten.");
assert(dispatch.includes("distanceKm === null"), "Unbekannte Entfernungen duerfen nicht als feste Kilometerzahl erscheinen.");
assert(routing.includes('provider: "haversine-estimate"'), "Lokale Routenberechnung muss als Schätzung erkennbar bleiben.");
console.log("Dispatch distance source checks passed.");
