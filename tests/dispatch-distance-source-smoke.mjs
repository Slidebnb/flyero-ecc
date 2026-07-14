import { readFileSync } from "node:fs";
function assert(condition, message) { if (!condition) throw new Error(message); }
const dispatch = readFileSync("src/lib/dispatch.ts", "utf8");
const routing = readFileSync("src/lib/routing.ts", "utf8");
assert(dispatch.includes("cityDistanceKm"), "Dispatch-Distanzberechnung fehlt.");
assert(dispatch.includes("regional-estimate"), "Regionale Dispatch-Distanz muss als Schätzung markiert werden.");
assert(routing.includes('provider: "haversine-estimate"'), "Lokale Routenberechnung muss als Schätzung erkennbar bleiben.");
console.log("Dispatch distance source checks passed.");
